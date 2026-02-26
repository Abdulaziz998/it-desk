import type { OrganizationPlan, OrganizationPlanStatus } from "@prisma/client";

export const PLAN_LABELS: Record<OrganizationPlan, string> = {
  FREE: "Free",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export type BillingFeature = "jobs" | "entra" | "auditRetention" | "rbacExport";

export function hasFeature(plan: OrganizationPlan, feature: BillingFeature) {
  if (plan === "ENTERPRISE") {
    return true;
  }

  if (plan === "PRO") {
    return feature === "jobs" || feature === "entra";
  }

  return false;
}

function isPaidStatus(status: OrganizationPlanStatus) {
  return status === "ACTIVE" || status === "TRIALING";
}

export function effectivePlan(plan: OrganizationPlan, status: OrganizationPlanStatus): OrganizationPlan {
  if (plan === "FREE") {
    return "FREE";
  }

  return isPaidStatus(status) ? plan : "FREE";
}
