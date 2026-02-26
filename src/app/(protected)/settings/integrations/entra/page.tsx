import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { EntraIntegrationClient } from "@/app/(protected)/settings/integrations/entra/entra-integration-client";
import { effectivePlan, hasFeature } from "@/lib/billing/plans";

export default async function EntraIntegrationPage() {
  const context = await requirePagePermission("settings.manage");

  const [org, integration] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        plan: true,
        planStatus: true,
      },
    }),
    prisma.entraIntegration.findUnique({
      where: {
        orgId_provider: {
          orgId: context.orgId,
          provider: "entra",
        },
      },
    }),
  ]);

  const initialValues = {
    enabled: integration?.enabled ?? false,
    tenantId: integration?.tenantId ?? "",
    clientId: integration?.clientId ?? "",
    clientSecret: integration?.clientSecret ?? "",
  };

  const isConnected = Boolean(integration?.enabled && integration.tenantId && integration.clientId && integration.clientSecret);
  const plan = org ? effectivePlan(org.plan, org.planStatus) : "FREE";
  const canUseEntra = hasFeature(plan, "entra");

  return <EntraIntegrationClient initialValues={initialValues} isConnected={isConnected} canUseEntra={canUseEntra} />;
}
