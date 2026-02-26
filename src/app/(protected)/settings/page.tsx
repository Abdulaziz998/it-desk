import Link from "next/link";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/app/(protected)/settings/settings-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const context = await requirePagePermission("settings.manage");

  const [org, setting, slaRules, categories, tags, notificationPreference, cannedResponses] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.orgId },
      select: {
        name: true,
        logoUrl: true,
      },
    }),
    prisma.organizationSetting.findUnique({
      where: {
        orgId: context.orgId,
      },
      select: {
        supportEmail: true,
        notificationEmail: true,
        brandPrimaryColor: true,
        brandSecondaryColor: true,
      },
    }),
    prisma.slaRule.findMany({
      where: {
        orgId: context.orgId,
      },
      orderBy: {
        priority: "asc",
      },
    }),
    prisma.category.findMany({
      where: {
        orgId: context.orgId,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.tag.findMany({
      where: {
        orgId: context.orgId,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.notificationPreference.findUnique({
      where: {
        orgId_userId: {
          orgId: context.orgId,
          userId: context.userId,
        },
      },
      select: {
        emailAssignments: true,
        emailMentions: true,
        emailSlaAlerts: true,
        inAppEnabled: true,
      },
    }),
    prisma.cannedResponse.findMany({
      where: {
        orgId: context.orgId,
      },
      orderBy: {
        title: "asc",
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/settings/integrations/entra" className="text-sm font-medium text-sky-700 hover:underline">
            Configure Microsoft Entra ID (mock)
          </Link>
        </CardContent>
      </Card>

      <SettingsClient
        org={{
          name: org?.name ?? "",
          logoUrl: org?.logoUrl ?? null,
          supportEmail: setting?.supportEmail ?? null,
          notificationEmail: setting?.notificationEmail ?? null,
          brandPrimaryColor: setting?.brandPrimaryColor ?? null,
          brandSecondaryColor: setting?.brandSecondaryColor ?? null,
        }}
        slaRules={slaRules.map((rule) => ({
          priority: rule.priority,
          responseMinutes: rule.responseMinutes,
          resolutionMinutes: rule.resolutionMinutes,
        }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name, keywords: category.keywords }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        notificationPreference={notificationPreference}
        cannedResponses={cannedResponses.map((response) => ({ id: response.id, title: response.title, content: response.content }))}
        canManageSettings={(await hasPermission(context.role, "settings.manage"))}
      />
    </div>
  );
}
