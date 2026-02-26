import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

type AuditLogInput = {
  orgId: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function recordAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeData: toJson(input.beforeData),
        afterData: toJson(input.afterData),
        metadata: toJson(input.metadata),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    logger.error("Failed to persist audit log", error, {
      orgId: input.orgId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}
