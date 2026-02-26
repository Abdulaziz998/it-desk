import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPlanForPriceId, getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

function mapStatus(status: StripeSubscriptionStatus) {
  switch (status) {
    case "active":
      return "ACTIVE" as const;
    case "trialing":
      return "TRIALING" as const;
    case "past_due":
      return "PAST_DUE" as const;
    case "canceled":
      return "CANCELED" as const;
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE" as const;
    case "unpaid":
      return "UNPAID" as const;
    case "paused":
      return "PAST_DUE" as const;
    default:
      return "INCOMPLETE" as const;
  }
}

async function updateOrgFromSubscription(subscription: Stripe.Subscription, fallbackOrgId?: string | null) {
  const priceId = subscription.items.data[0]?.price?.id;
  const mappedPlan = priceId ? getPlanForPriceId(priceId) : null;

  const whereOr: Array<{ stripeSubscriptionId?: string; stripeCustomerId?: string; id?: string }> = [
    { stripeSubscriptionId: subscription.id },
    { stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id },
  ];

  if (fallbackOrgId) {
    whereOr.push({ id: fallbackOrgId });
  }

  const org = await prisma.organization.findFirst({
    where: {
      OR: whereOr,
    },
  });

  if (!org) {
    logger.warn("Stripe webhook subscription update skipped: organization not found", {
      subscriptionId: subscription.id,
    });
    return;
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan: mappedPlan ?? "FREE",
      planStatus: mapStatus(subscription.status as StripeSubscriptionStatus),
    },
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook configuration" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        await updateOrgFromSubscription(subscription, session.metadata?.orgId ?? null);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      await updateOrgFromSubscription(subscription, subscription.metadata?.orgId ?? null);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await updateOrgFromSubscription(subscription, subscription.metadata?.orgId ?? null);

      const org = await prisma.organization.findFirst({
        where: {
          OR: [
            { stripeSubscriptionId: subscription.id },
            { stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id },
          ],
        },
      });

      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            plan: "FREE",
            planStatus: "CANCELED",
            stripeSubscriptionId: null,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook processing failed", error, {
      eventType: event.type,
    });

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
