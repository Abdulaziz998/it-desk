import Stripe from "stripe";

const globalForStripe = globalThis as unknown as {
  stripe?: Stripe;
};

export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!globalForStripe.stripe) {
    globalForStripe.stripe = new Stripe(apiKey, {
      apiVersion: "2026-02-25.clover",
    });
  }

  return globalForStripe.stripe;
}

export function getStripePriceIdForPlan(plan: "PRO" | "ENTERPRISE") {
  const id = plan === "PRO" ? process.env.STRIPE_PRICE_PRO_MONTHLY : process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY;
  if (!id) {
    throw new Error(`Stripe price is not configured for ${plan}`);
  }
  return id;
}

export function getPlanForPriceId(priceId: string) {
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    return "PRO" as const;
  }

  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY) {
    return "ENTERPRISE" as const;
  }

  return null;
}
