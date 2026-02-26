"use server";

import { z } from "zod";
import { TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import {
  cannedResponseSchema,
  ticketBulkActionSchema,
  ticketCommentSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
} from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";
import { calculateSlaFlags } from "@/server/services/sla-service";
import { createInAppNotifications, queueEmail } from "@/server/services/notification-service";
import { applyAutoAssignRule } from "@/server/services/auto-assign";

const ticketAttachmentSchema = z.object({
  ticketId: z.string(),
  filename: z.string().min(1).max(200),
  sizeBytes: z.coerce.number().int().min(1),
});

const ticketWatcherSchema = z.object({
  ticketId: z.string(),
  userId: z.string(),
});

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTicket(input: unknown) {
  return runSafeAction("createTicket", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketCreateSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid ticket payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const data = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: context.orgId },
        select: { id: true, slug: true, nextTicketNumber: true },
      });

      if (!org) {
        throw new AppError("Organization not found", "NOT_FOUND", 404);
      }

      const requesterId = data.requesterId ?? context.userId;

      const requesterMembership = await tx.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: requesterId,
          },
        },
      });

      if (!requesterMembership) {
        throw new AppError("Requester must belong to this organization", "REQUESTER_INVALID", 400);
      }

      if (data.assigneeId) {
        const assigneeMembership = await tx.organizationMember.findUnique({
          where: {
            orgId_userId: {
              orgId: context.orgId,
              userId: data.assigneeId,
            },
          },
        });
        if (!assigneeMembership) {
          throw new AppError("Assignee must belong to this organization", "ASSIGNEE_INVALID", 400);
        }
      }

      if (data.teamId) {
        const team = await tx.team.findFirst({
          where: { id: data.teamId, orgId: context.orgId },
          select: { id: true },
        });
        if (!team) {
          throw new AppError("Team not found in organization", "TEAM_INVALID", 400);
        }
      }

      if (data.categoryId) {
        const category = await tx.category.findFirst({
          where: { id: data.categoryId, orgId: context.orgId },
          select: { id: true },
        });
        if (!category) {
          throw new AppError("Category not found in organization", "CATEGORY_INVALID", 400);
        }
      }

      if (data.relatedAssetId) {
        const asset = await tx.asset.findFirst({
          where: { id: data.relatedAssetId, orgId: context.orgId },
          select: { id: true },
        });
        if (!asset) {
          throw new AppError("Asset not found in organization", "ASSET_INVALID", 400);
        }
      }

      let dueAt = normalizeDate(data.dueAt);

      if (!dueAt) {
        const rule = await tx.slaRule.findUnique({
          where: {
            orgId_priority: {
              orgId: context.orgId,
              priority: data.priority,
            },
          },
        });

        if (rule) {
          dueAt = new Date(Date.now() + rule.resolutionMinutes * 60 * 1000);
        }
      }

      const key = `${org.slug.toUpperCase()}-${org.nextTicketNumber}`;
      const slaFlags = calculateSlaFlags(dueAt);

      const ticket = await tx.ticket.create({
        data: {
          orgId: context.orgId,
          number: org.nextTicketNumber,
          key,
          title: data.title,
          description: data.description,
          priority: data.priority,
          status: "OPEN",
          requesterId,
          assigneeId: data.assigneeId,
          teamId: data.teamId,
          categoryId: data.categoryId,
          relatedAssetId: data.relatedAssetId,
          dueAt,
          atRisk: slaFlags.atRisk,
          breachedAt: slaFlags.breachedAt,
        },
      });

      await tx.organization.update({
        where: { id: context.orgId },
        data: {
          nextTicketNumber: {
            increment: 1,
          },
        },
      });

      if (data.tagIds.length) {
        const validTags = await tx.tag.findMany({
          where: {
            orgId: context.orgId,
            id: { in: data.tagIds },
          },
          select: { id: true },
        });

        if (validTags.length) {
          await tx.ticketTag.createMany({
            data: validTags.map((tag) => ({
              orgId: context.orgId,
              ticketId: ticket.id,
              tagId: tag.id,
            })),
          });
        }
      }

      const watcherIds = Array.from(new Set([context.userId, requesterId, data.assigneeId].filter(Boolean) as string[]));

      if (watcherIds.length) {
        await tx.ticketWatcher.createMany({
          data: watcherIds.map((userId) => ({
            orgId: context.orgId,
            ticketId: ticket.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      if (!data.assigneeId) {
        await applyAutoAssignRule(tx, {
          orgId: context.orgId,
          ticketId: ticket.id,
          categoryId: data.categoryId,
          fallbackTeamId: data.teamId,
        });
      }

      return await tx.ticket.findUnique({
        where: { id: ticket.id },
      });
    });

    if (!created) {
      throw new AppError("Failed to create ticket", "TICKET_CREATE_FAILED", 500);
    }

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_CREATED",
      entityType: "Ticket",
      entityId: created.id,
      afterData: {
        key: created.key,
        title: created.title,
        priority: created.priority,
        status: created.status,
      },
    });

    if (created.assigneeId) {
      await createInAppNotifications({
        orgId: context.orgId,
        userIds: [created.assigneeId],
        type: "ASSIGNMENT",
        title: `Assigned ticket ${created.key}`,
        message: created.title,
        link: `/tickets/${created.id}`,
      });

      const assignee = await prisma.user.findUnique({
        where: { id: created.assigneeId },
        select: { email: true },
      });

      if (assignee?.email) {
        await queueEmail({
          orgId: context.orgId,
          toEmail: assignee.email,
          subject: `Ticket assignment: ${created.key}`,
          body: `You were assigned ticket ${created.key}: ${created.title}`,
          createdById: context.userId,
        });
      }
    }

    return {
      id: created.id,
      key: created.key,
    };
  });
}

export async function updateTicket(input: unknown) {
  return runSafeAction("updateTicket", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketUpdateSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid ticket update", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const data = parsed.data;

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: data.ticketId,
        orgId: context.orgId,
      },
    });

    if (!ticket) {
      throw new AppError("Ticket not found", "NOT_FOUND", 404);
    }

    if (data.assigneeId) {
      const assigneeMembership = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: data.assigneeId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new AppError("Assignee is not a member of this organization", "ASSIGNEE_INVALID", 400);
      }
    }

    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: data.teamId,
          orgId: context.orgId,
        },
        select: {
          id: true,
        },
      });

      if (!team) {
        throw new AppError("Team is not a member of this organization", "TEAM_INVALID", 400);
      }
    }

    const dueAt = data.dueAt !== undefined ? normalizeDate(data.dueAt ?? undefined) : ticket.dueAt;

    const nextPriority = (data.priority ?? ticket.priority) as TicketPriority;
    const nextStatus = (data.status ?? ticket.status) as TicketStatus;

    const slaFlags = calculateSlaFlags(dueAt, ticket.breachedAt);

    const updated = await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        status: nextStatus,
        priority: nextPriority,
        assigneeId: data.assigneeId !== undefined ? data.assigneeId : ticket.assigneeId,
        teamId: data.teamId !== undefined ? data.teamId : ticket.teamId,
        dueAt,
        atRisk: slaFlags.atRisk,
        breachedAt: slaFlags.breachedAt,
        resolvedAt: nextStatus === "RESOLVED" ? ticket.resolvedAt ?? new Date() : ticket.resolvedAt,
        closedAt: nextStatus === "CLOSED" ? ticket.closedAt ?? new Date() : ticket.closedAt,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_UPDATED",
      entityType: "Ticket",
      entityId: ticket.id,
      beforeData: {
        status: ticket.status,
        priority: ticket.priority,
        assigneeId: ticket.assigneeId,
      },
      afterData: {
        status: updated.status,
        priority: updated.priority,
        assigneeId: updated.assigneeId,
      },
    });

    if (updated.assigneeId && updated.assigneeId !== ticket.assigneeId) {
      await createInAppNotifications({
        orgId: context.orgId,
        userIds: [updated.assigneeId],
        type: "ASSIGNMENT",
        title: `Assigned ticket ${updated.key}`,
        message: updated.title,
        link: `/tickets/${updated.id}`,
      });
    }

    return {
      ticketId: updated.id,
      status: updated.status,
    };
  });
}

export async function bulkUpdateTickets(input: unknown) {
  return runSafeAction("bulkUpdateTickets", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketBulkActionSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid bulk action payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const ticketIds = Array.from(new Set(data.ticketIds));

    let count = 0;

    if (data.action === "ASSIGN") {
      if (!data.assigneeId) {
        throw new AppError("Assignee is required for assign action", "VALIDATION_ERROR", 400);
      }

      const assigneeMembership = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: data.assigneeId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new AppError("Assignee must belong to this organization", "ASSIGNEE_INVALID", 400);
      }

      const result = await prisma.ticket.updateMany({
        where: {
          orgId: context.orgId,
          id: { in: ticketIds },
        },
        data: {
          assigneeId: data.assigneeId,
        },
      });
      count = result.count;
    }

    if (data.action === "SET_STATUS") {
      if (!data.status) {
        throw new AppError("Status is required for status bulk action", "VALIDATION_ERROR", 400);
      }

      const result = await prisma.ticket.updateMany({
        where: {
          orgId: context.orgId,
          id: { in: ticketIds },
        },
        data: {
          status: data.status,
        },
      });
      count = result.count;
    }

    if (data.action === "SET_PRIORITY") {
      if (!data.priority) {
        throw new AppError("Priority is required for priority bulk action", "VALIDATION_ERROR", 400);
      }

      const result = await prisma.ticket.updateMany({
        where: {
          orgId: context.orgId,
          id: { in: ticketIds },
        },
        data: {
          priority: data.priority,
        },
      });
      count = result.count;
    }

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_BULK_UPDATED",
      entityType: "Ticket",
      metadata: {
        action: data.action,
        ticketIds,
        count,
      },
    });

    return { count };
  });
}

export async function addTicketComment(input: unknown) {
  return runSafeAction("addTicketComment", async () => {
    const parsed = ticketCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid comment payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const permission = parsed.data.isInternal ? "ticket.write" : "ticket.write";
    const context = await requirePermission(permission);

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: parsed.data.ticketId,
        orgId: context.orgId,
      },
      include: {
        watchers: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new AppError("Ticket not found", "NOT_FOUND", 404);
    }

    const mentionEmails = Array.from(
      parsed.data.body.matchAll(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g),
    ).map((match) => match[1].toLowerCase());

    const mentionedUsers = mentionEmails.length
      ? await prisma.organizationMember.findMany({
          where: {
            orgId: context.orgId,
            user: {
              email: { in: mentionEmails },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        })
      : [];

    const comment = await prisma.ticketComment.create({
      data: {
        orgId: context.orgId,
        ticketId: ticket.id,
        authorId: context.userId,
        body: parsed.data.body,
        isInternal: parsed.data.isInternal,
        mentions: mentionEmails,
      },
    });

    const notifyUserIds = Array.from(
      new Set(
        [
          ...ticket.watchers.map((watcher) => watcher.userId),
          ticket.assigneeId,
          ticket.requesterId,
          ...mentionedUsers.map((member) => member.user.id),
        ].filter((id) => id && id !== context.userId) as string[],
      ),
    );

    if (notifyUserIds.length) {
      await createInAppNotifications({
        orgId: context.orgId,
        userIds: notifyUserIds,
        type: mentionedUsers.length ? "MENTION" : "SYSTEM",
        title: `Comment on ${ticket.key}`,
        message: parsed.data.body.slice(0, 140),
        link: `/tickets/${ticket.id}`,
      });
    }

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_COMMENT_ADDED",
      entityType: "Ticket",
      entityId: ticket.id,
      metadata: {
        commentId: comment.id,
        isInternal: comment.isInternal,
      },
    });

    return {
      commentId: comment.id,
    };
  });
}

export async function addTicketWatcher(input: unknown) {
  return runSafeAction("addTicketWatcher", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketWatcherSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid watcher payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        orgId_userId: {
          orgId: context.orgId,
          userId: parsed.data.userId,
        },
      },
    });

    if (!membership) {
      throw new AppError("Watcher must belong to the organization", "WATCHER_INVALID", 400);
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: parsed.data.ticketId,
        orgId: context.orgId,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new AppError("Ticket not found", "NOT_FOUND", 404);
    }

    await prisma.ticketWatcher.upsert({
      where: {
        ticketId_userId: {
          ticketId: parsed.data.ticketId,
          userId: parsed.data.userId,
        },
      },
      create: {
        orgId: context.orgId,
        ticketId: parsed.data.ticketId,
        userId: parsed.data.userId,
      },
      update: {},
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_WATCHER_ADDED",
      entityType: "Ticket",
      entityId: parsed.data.ticketId,
      metadata: {
        watcherUserId: parsed.data.userId,
      },
    });

    return { success: true };
  });
}

export async function removeTicketWatcher(input: unknown) {
  return runSafeAction("removeTicketWatcher", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketWatcherSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid watcher payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    await prisma.ticketWatcher.deleteMany({
      where: {
        orgId: context.orgId,
        ticketId: parsed.data.ticketId,
        userId: parsed.data.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_WATCHER_REMOVED",
      entityType: "Ticket",
      entityId: parsed.data.ticketId,
      metadata: {
        watcherUserId: parsed.data.userId,
      },
    });

    return { success: true };
  });
}

export async function createTicketAttachmentStub(input: unknown) {
  return runSafeAction("createTicketAttachmentStub", async () => {
    const context = await requirePermission("ticket.write");
    const parsed = ticketAttachmentSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid attachment payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: parsed.data.ticketId,
        orgId: context.orgId,
      },
      select: {
        id: true,
      },
    });

    if (!ticket) {
      throw new AppError("Ticket not found", "NOT_FOUND", 404);
    }

    const attachment = await prisma.ticketAttachment.create({
      data: {
        orgId: context.orgId,
        ticketId: parsed.data.ticketId,
        filename: parsed.data.filename,
        sizeBytes: parsed.data.sizeBytes,
        url: `/uploads/tickets/${parsed.data.ticketId}/${encodeURIComponent(parsed.data.filename)}`,
        uploadedById: context.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TICKET_ATTACHMENT_ADDED",
      entityType: "Ticket",
      entityId: parsed.data.ticketId,
      metadata: {
        attachmentId: attachment.id,
        filename: attachment.filename,
      },
    });

    return attachment;
  });
}

export async function createCannedResponse(input: unknown) {
  return runSafeAction("createCannedResponse", async () => {
    const context = await requirePermission("kb.write");
    const parsed = cannedResponseSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid canned response", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const response = await prisma.cannedResponse.create({
      data: {
        orgId: context.orgId,
        title: parsed.data.title,
        content: parsed.data.content,
        createdById: context.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "CANNED_RESPONSE_CREATED",
      entityType: "CannedResponse",
      entityId: response.id,
      metadata: {
        title: response.title,
      },
    });

    return response;
  });
}

export async function deleteCannedResponse(id: string) {
  return runSafeAction("deleteCannedResponse", async () => {
    const context = await requirePermission("kb.write");

    const response = await prisma.cannedResponse.deleteMany({
      where: {
        orgId: context.orgId,
        id,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "CANNED_RESPONSE_DELETED",
      entityType: "CannedResponse",
      entityId: id,
    });

    return { deleted: response.count > 0 };
  });
}
