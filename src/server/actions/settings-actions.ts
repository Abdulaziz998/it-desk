"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import {
  categorySchema,
  notificationPreferenceSchema,
  orgProfileSchema,
  slaRuleSchema,
  tagSchema,
} from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

const deleteByIdSchema = z.object({ id: z.string() });

export async function updateOrganizationProfile(input: unknown) {
  return runSafeAction("updateOrganizationProfile", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = orgProfileSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid org profile payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: context.orgId },
      data: {
        name: parsed.data.name,
        logoUrl: parsed.data.logoUrl || null,
      },
    });

    await prisma.organizationSetting.upsert({
      where: { orgId: context.orgId },
      create: {
        orgId: context.orgId,
        supportEmail: parsed.data.supportEmail || null,
        notificationEmail: parsed.data.notificationEmail || null,
        brandPrimaryColor: parsed.data.brandPrimaryColor,
        brandSecondaryColor: parsed.data.brandSecondaryColor,
      },
      update: {
        supportEmail: parsed.data.supportEmail || null,
        notificationEmail: parsed.data.notificationEmail || null,
        brandPrimaryColor: parsed.data.brandPrimaryColor,
        brandSecondaryColor: parsed.data.brandSecondaryColor,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ORG_PROFILE_UPDATED",
      entityType: "Organization",
      entityId: context.orgId,
      metadata: {
        name: updatedOrg.name,
      },
    });

    return updatedOrg;
  });
}

export async function upsertSlaRule(input: unknown) {
  return runSafeAction("upsertSlaRule", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = slaRuleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid SLA payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const rule = await prisma.slaRule.upsert({
      where: {
        orgId_priority: {
          orgId: context.orgId,
          priority: parsed.data.priority,
        },
      },
      create: {
        orgId: context.orgId,
        priority: parsed.data.priority,
        responseMinutes: parsed.data.responseMinutes,
        resolutionMinutes: parsed.data.resolutionMinutes,
      },
      update: {
        responseMinutes: parsed.data.responseMinutes,
        resolutionMinutes: parsed.data.resolutionMinutes,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "SLA_RULE_UPDATED",
      entityType: "SlaRule",
      entityId: rule.id,
      metadata: {
        priority: rule.priority,
      },
    });

    return rule;
  });
}

export async function createCategory(input: unknown) {
  return runSafeAction("createCategory", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = categorySchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid category payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const category = await prisma.category.create({
      data: {
        orgId: context.orgId,
        name: parsed.data.name,
        description: parsed.data.description,
        keywords: parsed.data.keywords,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category.id,
      metadata: {
        name: category.name,
      },
    });

    return category;
  });
}

export async function deleteCategory(input: unknown) {
  return runSafeAction("deleteCategory", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = deleteByIdSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid category delete payload", "VALIDATION_ERROR", 400);
    }

    await prisma.category.deleteMany({
      where: {
        orgId: context.orgId,
        id: parsed.data.id,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: parsed.data.id,
    });

    return { success: true };
  });
}

export async function createTag(input: unknown) {
  return runSafeAction("createTag", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = tagSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid tag payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const tag = await prisma.tag.create({
      data: {
        orgId: context.orgId,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TAG_CREATED",
      entityType: "Tag",
      entityId: tag.id,
      metadata: {
        name: tag.name,
      },
    });

    return tag;
  });
}

export async function deleteTag(input: unknown) {
  return runSafeAction("deleteTag", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = deleteByIdSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid tag delete payload", "VALIDATION_ERROR", 400);
    }

    await prisma.tag.deleteMany({
      where: {
        orgId: context.orgId,
        id: parsed.data.id,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TAG_DELETED",
      entityType: "Tag",
      entityId: parsed.data.id,
    });

    return { success: true };
  });
}

export async function updateNotificationPreferences(input: unknown) {
  return runSafeAction("updateNotificationPreferences", async () => {
    const context = await requireAuthContext();
    const parsed = notificationPreferenceSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid notification preferences payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const preference = await prisma.notificationPreference.upsert({
      where: {
        orgId_userId: {
          orgId: context.orgId,
          userId: context.userId,
        },
      },
      create: {
        orgId: context.orgId,
        userId: context.userId,
        emailAssignments: parsed.data.emailAssignments,
        emailMentions: parsed.data.emailMentions,
        emailSlaAlerts: parsed.data.emailSlaAlerts,
        inAppEnabled: parsed.data.inAppEnabled,
      },
      update: {
        emailAssignments: parsed.data.emailAssignments,
        emailMentions: parsed.data.emailMentions,
        emailSlaAlerts: parsed.data.emailSlaAlerts,
        inAppEnabled: parsed.data.inAppEnabled,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "NOTIFICATION_PREF_UPDATED",
      entityType: "NotificationPreference",
      entityId: preference.id,
    });

    return preference;
  });
}
