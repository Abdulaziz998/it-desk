import { hasPermission } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { AccessRequestsClient } from "@/app/(protected)/access-requests/access-requests-client";

export default async function AccessRequestsPage() {
  const context = await requirePagePermission("accessRequests.execute");

  const [requests, approvers, entraIntegration] = await Promise.all([
    prisma.accessRequest.findMany({
      where: {
        orgId: context.orgId,
      },
      include: {
        requester: {
          select: {
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
        attachments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),
    prisma.organizationMember.findMany({
      where: {
        orgId: context.orgId,
        role: {
          in: ["OrgAdmin", "Agent"],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
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

  return (
    <AccessRequestsClient
      requests={requests.map((request) => ({
        id: request.id,
        requestType: request.requestType,
        status: request.status,
        title: request.title,
        description: request.description,
        targetUpn: request.targetUpn,
        targetGroupId: request.targetGroupId,
        appRoleName: request.appRoleName,
        requesterName: request.requester.name ?? request.requester.email,
        assignedToName: request.assignedTo?.name ?? request.assignedTo?.email ?? "Auto",
        createdAt: request.createdAt,
        attachments: request.attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          sizeBytes: attachment.sizeBytes,
          url: attachment.url,
        })),
      }))}
      approvers={approvers.map((approver) => ({ userId: approver.user.id, name: approver.user.name ?? approver.user.email }))}
      canApprove={(await hasPermission(context.role, "accessRequests.approve"))}
      canExecuteInEntra={(await hasPermission(context.role, "accessRequests.execute"))}
      isEntraConfigured={Boolean(
        entraIntegration?.enabled && entraIntegration.tenantId && entraIntegration.clientId && entraIntegration.clientSecret,
      )}
    />
  );
}
