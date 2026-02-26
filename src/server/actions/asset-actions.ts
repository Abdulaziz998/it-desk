"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { assetSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

const updateAssetSchema = assetSchema.extend({
  assetId: z.string(),
});

const deleteAssetSchema = z.object({
  assetId: z.string(),
});

export async function createAsset(input: unknown) {
  return runSafeAction("createAsset", async () => {
    const context = await requirePermission("assets.write");
    const parsed = assetSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid asset payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    if (parsed.data.assignedToId) {
      const assignee = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: parsed.data.assignedToId,
          },
        },
      });

      if (!assignee) {
        throw new AppError("Assignee must belong to the organization", "ASSIGNEE_INVALID", 400);
      }
    }

    const asset = await prisma.asset.create({
      data: {
        orgId: context.orgId,
        assetTag: parsed.data.assetTag,
        type: parsed.data.type,
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId || null,
        status: parsed.data.status,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null,
        notes: parsed.data.notes,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ASSET_CREATED",
      entityType: "Asset",
      entityId: asset.id,
      metadata: {
        assetTag: asset.assetTag,
      },
    });

    return asset;
  });
}

export async function updateAsset(input: unknown) {
  return runSafeAction("updateAsset", async () => {
    const context = await requirePermission("assets.write");
    const parsed = updateAssetSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid asset update payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await prisma.asset.findFirst({
      where: {
        id: parsed.data.assetId,
        orgId: context.orgId,
      },
    });

    if (!existing) {
      throw new AppError("Asset not found", "NOT_FOUND", 404);
    }

    if (parsed.data.assignedToId) {
      const assignee = await prisma.organizationMember.findUnique({
        where: {
          orgId_userId: {
            orgId: context.orgId,
            userId: parsed.data.assignedToId,
          },
        },
      });

      if (!assignee) {
        throw new AppError("Assignee must belong to the organization", "ASSIGNEE_INVALID", 400);
      }
    }

    const asset = await prisma.asset.update({
      where: { id: existing.id },
      data: {
        assetTag: parsed.data.assetTag,
        type: parsed.data.type,
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId || null,
        status: parsed.data.status,
        purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : null,
        notes: parsed.data.notes,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ASSET_UPDATED",
      entityType: "Asset",
      entityId: asset.id,
      beforeData: {
        name: existing.name,
        status: existing.status,
      },
      afterData: {
        name: asset.name,
        status: asset.status,
      },
    });

    return asset;
  });
}

export async function deleteAsset(input: unknown) {
  return runSafeAction("deleteAsset", async () => {
    const context = await requirePermission("assets.write");
    const parsed = deleteAssetSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid delete payload", "VALIDATION_ERROR", 400);
    }

    const deleted = await prisma.asset.deleteMany({
      where: {
        orgId: context.orgId,
        id: parsed.data.assetId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ASSET_DELETED",
      entityType: "Asset",
      entityId: parsed.data.assetId,
    });

    return { deleted: deleted.count > 0 };
  });
}
