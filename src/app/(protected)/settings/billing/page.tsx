import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { BillingClient } from "@/app/(protected)/settings/billing/billing-client";
import { PLAN_LABELS, effectivePlan, hasFeature } from "@/lib/billing/plans";

export default async function SettingsBillingPage() {
  const context = await requirePagePermission("settings.manage");

  const [org, setting] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        name: true,
        plan: true,
        planStatus: true,
      },
    }),
    prisma.organizationSetting.findUnique({
      where: { orgId: context.orgId },
      select: {
        auditLogRetentionDays: true,
      },
    }),
  ]);

  if (!org) {
    return null;
  }

  const computedPlan = effectivePlan(org.plan, org.planStatus);

  return (
    <BillingClient
      orgName={org.name}
      planLabel={PLAN_LABELS[computedPlan]}
      planStatus={org.planStatus}
      stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO_MONTHLY && process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY)}
      hasEnterpriseFeatures={hasFeature(computedPlan, "auditRetention")}
      auditRetentionDays={setting?.auditLogRetentionDays ?? 90}
    />
  );
}
