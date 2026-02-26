"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { autoAssignRuleSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";
import { runOrgWorkflows } from "@/server/services/workflow-runner";

const ruleToggleSchema = z.object({
  ruleId: z.string(),
  isActive: z.boolean(),
});

const ruleDeleteSchema = z.object({
  ruleId: z.string(),
});

export async function createAutoAssignRule(input: unknown) {
  return runSafeAction("createAutoAssignRule", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = autoAssignRuleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid rule payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    if (parsed.data.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: parsed.data.categoryId,
          orgId: context.orgId,
        },
        select: { id: true },
      });

      if (!category) {
        throw new AppError("Category not found in organization", "CATEGORY_INVALID", 400);
      }
    }

    if (parsed.data.teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: parsed.data.teamId,
          orgId: context.orgId,
        },
        select: { id: true },
      });

      if (!team) {
        throw new AppError("Team not found in organization", "TEAM_INVALID", 400);
      }
    }

    const rule = await prisma.autoAssignRule.create({
      data: {
        orgId: context.orgId,
        name: parsed.data.name,
        categoryId: parsed.data.categoryId || null,
        teamId: parsed.data.teamId || null,
        assignmentStrategy: parsed.data.assignmentStrategy,
        isActive: parsed.data.isActive,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "AUTO_ASSIGN_RULE_CREATED",
      entityType: "AutoAssignRule",
      entityId: rule.id,
      metadata: {
        name: rule.name,
      },
    });

    return rule;
  });
}

export async function toggleAutoAssignRule(input: unknown) {
  return runSafeAction("toggleAutoAssignRule", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = ruleToggleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid rule payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await prisma.autoAssignRule.findFirst({
      where: {
        id: parsed.data.ruleId,
        orgId: context.orgId,
      },
    });

    if (!existing) {
      throw new AppError("Rule not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.autoAssignRule.update({
      where: {
        id: existing.id,
      },
      data: {
        isActive: parsed.data.isActive,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "AUTO_ASSIGN_RULE_TOGGLED",
      entityType: "AutoAssignRule",
      entityId: updated.id,
      metadata: {
        isActive: updated.isActive,
      },
    });

    return updated;
  });
}

export async function deleteAutoAssignRule(input: unknown) {
  return runSafeAction("deleteAutoAssignRule", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = ruleDeleteSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid rule payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const deleted = await prisma.autoAssignRule.deleteMany({
      where: {
        orgId: context.orgId,
        id: parsed.data.ruleId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "AUTO_ASSIGN_RULE_DELETED",
      entityType: "AutoAssignRule",
      entityId: parsed.data.ruleId,
    });

    return { deleted: deleted.count > 0 };
  });
}

export async function runWorkflowNow() {
  return runSafeAction("runWorkflowNow", async () => {
    const context = await requirePermission("settings.manage");
    return runOrgWorkflows(context.orgId, context.userId);
  });
}
