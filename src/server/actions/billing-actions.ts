"use server";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripeClient, getStripePriceIdForPlan } from "@/lib/stripe";
import { requirePermission } from "@/lib/auth/context";
import { runSafeAction } from "@/server/action-utils";
import { recordAuditLog } from "@/lib/audit";
import { hasFeature } from "@/lib/billing/plans";

type CheckoutPlan = "PRO" | "ENTERPRISE";

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function createCheckoutSession(input: { plan: CheckoutPlan }) {
  return runSafeAction("createCheckoutSession", async () => {
    const context = await requirePermission("settings.manage");

    const org = await prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
      },
    });

    if (!org) {
      throw new AppError("Organization not found", "NOT_FOUND", 404);
    }

    const stripe = getStripeClient();

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          orgId: org.id,
        },
      });

      customerId = customer.id;

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeCustomerId: customerId,
        },
      });
    }

    const baseUrl = getBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: getStripePriceIdForPlan(input.plan),
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings/billing?checkout=success`,
      cancel_url: `${baseUrl}/settings/billing?checkout=canceled`,
      metadata: {
        orgId: org.id,
        targetPlan: input.plan,
      },
      subscription_data: {
        metadata: {
          orgId: org.id,
          targetPlan: input.plan,
        },
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "BILLING_CHECKOUT_CREATED",
      entityType: "Billing",
      entityId: session.id,
      metadata: {
        plan: input.plan,
      },
    });

    return {
      url: session.url,
    };
  });
}

export async function createBillingPortalSession() {
  return runSafeAction("createBillingPortalSession", async () => {
    const context = await requirePermission("settings.manage");

    const org = await prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!org?.stripeCustomerId) {
      throw new AppError("Stripe customer is not configured for this organization", "BILLING_NOT_CONFIGURED", 400);
    }

    const stripe = getStripeClient();
    const baseUrl = getBaseUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${baseUrl}/settings/billing`,
    });

    return {
      url: session.url,
    };
  });
}

export async function updateAuditRetentionSetting(input: { days: number }) {
  return runSafeAction("updateAuditRetentionSetting", async () => {
    const context = await requirePermission("settings.manage");

    const org = await prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        plan: true,
      },
    });

    if (!org || !hasFeature(org.plan, "auditRetention")) {
      throw new AppError("Enterprise plan required", "PLAN_GATED", 403);
    }

    const normalized = Math.max(30, Math.min(3650, Math.round(input.days)));

    const setting = await prisma.organizationSetting.upsert({
      where: { orgId: context.orgId },
      create: {
        orgId: context.orgId,
        auditLogRetentionDays: normalized,
      },
      update: {
        auditLogRetentionDays: normalized,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "AUDIT_RETENTION_UPDATED",
      entityType: "OrganizationSetting",
      entityId: setting.id,
      metadata: {
        days: normalized,
      },
    });

    return {
      auditLogRetentionDays: setting.auditLogRetentionDays,
    };
  });
}
