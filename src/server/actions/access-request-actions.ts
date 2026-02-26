"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import { accessRequestSchema, accessRequestStatusSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";
import { createInAppNotifications, queueEmail } from "@/server/services/notification-service";
import { createMockEntraClient } from "@/lib/integrations/entra/client";

const accessAttachmentSchema = z.object({
  accessRequestId: z.string(),
  filename: z.string().min(1),
  sizeBytes: z.coerce.number().int().positive(),
});

const executeAccessRequestSchema = z.object({
  accessRequestId: z.string(),
});

export async function createAccessRequest(input: unknown) {
  return runSafeAction("createAccessRequest", async () => {
    const context = await requirePermission("accessRequests.execute");
    const parsed = accessRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid access request payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const manager = await prisma.organizationMember.findFirst({
      where: {
        orgId: context.orgId,
        isManager: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (parsed.data.assignedToId) {
      const assigneeMembership = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: parsed.data.assignedToId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new AppError("Assigned approver must belong to the organization", "ASSIGNEE_INVALID", 400);
      }
    }

    if (parsed.data.relatedTicketId) {
      const relatedTicket = await prisma.ticket.findFirst({
        where: {
          id: parsed.data.relatedTicketId,
          orgId: context.orgId,
        },
        select: { id: true },
      });

      if (!relatedTicket) {
        throw new AppError("Related ticket not found in organization", "TICKET_INVALID", 400);
      }
    }

    const request = await prisma.accessRequest.create({
      data: {
        orgId: context.orgId,
        requestType: parsed.data.requestType,
        title: parsed.data.title,
        description: parsed.data.description,
        targetUpn: parsed.data.targetUpn,
        targetGroupId: parsed.data.targetGroupId,
        appRoleName: parsed.data.appRoleName,
        requesterId: context.userId,
        managerApproverId: manager?.userId,
        assignedToId: parsed.data.assignedToId,
        relatedTicketId: parsed.data.relatedTicketId,
        status: "SUBMITTED",
      },
    });

    const approvers = await prisma.organizationMember.findMany({
      where: {
        orgId: context.orgId,
        role: {
          in: ["OrgAdmin", "Agent"],
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 10,
    });

    await createInAppNotifications({
      orgId: context.orgId,
      userIds: approvers.map((item) => item.userId),
      type: "ACCESS_REQUEST",
      title: `Access request submitted: ${request.title}`,
      message: request.requestType,
      link: "/access-requests",
    });

    await Promise.all(
      approvers
        .map((item) => item.user.email)
        .filter(Boolean)
        .map((email) =>
          queueEmail({
            orgId: context.orgId,
            toEmail: email as string,
            subject: `Access request submitted: ${request.title}`,
            body: `${request.description}\n\nReview in /access-requests`,
            createdById: context.userId,
          }),
        ),
    );

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ACCESS_REQUEST_CREATED",
      entityType: "AccessRequest",
      entityId: request.id,
      metadata: {
        requestType: request.requestType,
      },
    });

    return request;
  });
}

export async function updateAccessRequestStatus(input: unknown) {
  return runSafeAction("updateAccessRequestStatus", async () => {
    const context = await requirePermission("accessRequests.approve");
    const parsed = accessRequestStatusSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid access request status payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const accessRequest = await prisma.accessRequest.findFirst({
      where: {
        id: parsed.data.accessRequestId,
        orgId: context.orgId,
      },
    });

    if (!accessRequest) {
      throw new AppError("Access request not found", "NOT_FOUND", 404);
    }

    const status = parsed.data.status;

    const updated = await prisma.accessRequest.update({
      where: { id: accessRequest.id },
      data: {
        status,
        finalApproverId: context.userId,
        approvedAt: status === "APPROVED" ? new Date() : accessRequest.approvedAt,
        rejectedAt: status === "REJECTED" ? new Date() : accessRequest.rejectedAt,
        completedAt: status === "COMPLETED" ? new Date() : accessRequest.completedAt,
      },
    });

    await createInAppNotifications({
      orgId: context.orgId,
      userIds: [accessRequest.requesterId],
      type: "ACCESS_REQUEST",
      title: `Access request ${status.toLowerCase()}`,
      message: updated.title,
      link: "/access-requests",
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ACCESS_REQUEST_STATUS_CHANGED",
      entityType: "AccessRequest",
      entityId: updated.id,
      beforeData: {
        status: accessRequest.status,
      },
      afterData: {
        status: updated.status,
      },
    });

    return updated;
  });
}

export async function addAccessRequestAttachment(input: unknown) {
  return runSafeAction("addAccessRequestAttachment", async () => {
    const context = await requireAuthContext();
    const parsed = accessAttachmentSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid attachment payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const accessRequest = await prisma.accessRequest.findFirst({
      where: {
        id: parsed.data.accessRequestId,
        orgId: context.orgId,
      },
      select: {
        id: true,
      },
    });

    if (!accessRequest) {
      throw new AppError("Access request not found", "NOT_FOUND", 404);
    }

    const attachment = await prisma.accessRequestAttachment.create({
      data: {
        orgId: context.orgId,
        accessRequestId: accessRequest.id,
        filename: parsed.data.filename,
        sizeBytes: parsed.data.sizeBytes,
        url: `/uploads/access/${accessRequest.id}/${encodeURIComponent(parsed.data.filename)}`,
        uploadedById: context.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ACCESS_REQUEST_ATTACHMENT_ADDED",
      entityType: "AccessRequest",
      entityId: accessRequest.id,
      metadata: {
        attachmentId: attachment.id,
      },
    });

    return attachment;
  });
}

export async function executeAccessRequestInEntra(input: unknown) {
  return runSafeAction("executeAccessRequestInEntra", async () => {
    const context = await requirePermission("accessRequests.execute");
    const parsed = executeAccessRequestSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid execute payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const [accessRequest, integration] = await Promise.all([
      prisma.accessRequest.findFirst({
        where: {
          id: parsed.data.accessRequestId,
          orgId: context.orgId,
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

    if (!accessRequest) {
      throw new AppError("Access request not found", "NOT_FOUND", 404);
    }

    if (!integration || !integration.enabled || !integration.tenantId || !integration.clientId || !integration.clientSecret) {
      throw new AppError("Entra integration is not configured", "INTEGRATION_NOT_CONFIGURED", 400);
    }

    const client = createMockEntraClient({
      orgId: context.orgId,
      actorUserId: context.userId,
      accessRequestId: accessRequest.id,
    });

    const upn = accessRequest.targetUpn;
    const groupId = accessRequest.targetGroupId;
    let executionMessage = "";
    let succeeded = false;

    try {
      switch (accessRequest.requestType) {
        case "ADD_USER_TO_GROUP": {
          if (!upn || !groupId) {
            throw new AppError("Target UPN and group ID are required", "ACCESS_REQUEST_MISSING_TARGET", 400);
          }
          await client.addUserToGroup(upn, groupId);
          executionMessage = `User ${upn} added to group ${groupId} (mock).`;
          break;
        }
        case "REMOVE_FROM_GROUP": {
          if (!upn || !groupId) {
            throw new AppError("Target UPN and group ID are required", "ACCESS_REQUEST_MISSING_TARGET", 400);
          }
          await client.removeUserFromGroup(upn, groupId);
          executionMessage = `User ${upn} removed from group ${groupId} (mock).`;
          break;
        }
        case "RESET_MFA": {
          if (!upn) {
            throw new AppError("Target UPN is required", "ACCESS_REQUEST_MISSING_TARGET", 400);
          }
          await client.resetMfa(upn);
          executionMessage = `MFA reset initiated for ${upn} (mock).`;
          break;
        }
        case "GRANT_APP_ROLE": {
          executionMessage = "Grant app role is not implemented yet in mock executor.";
          await prisma.integrationActionLog.create({
            data: {
              orgId: context.orgId,
              provider: "entra",
              action: "grantAppRole",
              targetUpn: upn,
              targetGroupId: groupId,
              accessRequestId: accessRequest.id,
              status: "FAILED",
              message: executionMessage,
            },
          });
          break;
        }
      }

      succeeded = accessRequest.requestType !== "GRANT_APP_ROLE";
    } catch (error) {
      executionMessage = error instanceof Error ? error.message : "Execution failed";
    }

    const status = succeeded ? "COMPLETED" : "FAILED";
    const now = new Date();

    await prisma.accessRequest.update({
      where: { id: accessRequest.id },
      data: {
        status,
        completedAt: succeeded ? now : accessRequest.completedAt,
      },
    });

    await createInAppNotifications({
      orgId: context.orgId,
      userIds: [accessRequest.requesterId],
      type: "ACCESS_REQUEST",
      title: succeeded ? "Access request completed in Entra (mock)" : "Access request failed in Entra (mock)",
      message: executionMessage,
      link: "/access-requests",
      metadata: {
        accessRequestId: accessRequest.id,
        status,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: succeeded ? "ACCESS_REQUEST_ENTRA_EXECUTED" : "ACCESS_REQUEST_ENTRA_EXECUTION_FAILED",
      entityType: "AccessRequest",
      entityId: accessRequest.id,
      metadata: {
        requestType: accessRequest.requestType,
        status,
        message: executionMessage,
      },
    });

    return {
      status,
      message: executionMessage,
    };
  });
}
