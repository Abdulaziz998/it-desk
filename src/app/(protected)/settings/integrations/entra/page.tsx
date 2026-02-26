import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { EntraIntegrationClient } from "@/app/(protected)/settings/integrations/entra/entra-integration-client";

export default async function EntraIntegrationPage() {
  const context = await requirePagePermission("settings.manage");

  const integration = await prisma.entraIntegration.findUnique({
    where: {
      orgId_provider: {
        orgId: context.orgId,
        provider: "entra",
      },
    },
  });

  const initialValues = {
    enabled: integration?.enabled ?? false,
    tenantId: integration?.tenantId ?? "",
    clientId: integration?.clientId ?? "",
    clientSecret: integration?.clientSecret ?? "",
  };

  const isConnected = Boolean(integration?.enabled && integration.tenantId && integration.clientId && integration.clientSecret);

  return <EntraIntegrationClient initialValues={initialValues} isConnected={isConnected} />;
}
