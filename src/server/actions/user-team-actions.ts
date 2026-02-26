"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requirePermission, requireRole } from "@/lib/auth/context";
import { teamSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

const updateRoleSchema = z.object({
  memberId: z.string(),
  role: z.enum(["OrgAdmin", "Agent", "Requester", "ReadOnly"]),
});

const updateCapacitySchema = z.object({
  memberId: z.string(),
  agentCapacity: z.coerce.number().int().min(1).max(500),
});

const teamMemberSchema = z.object({
  teamId: z.string(),
  memberId: z.string(),
});

export async function updateOrganizationMemberRole(input: unknown) {
  return runSafeAction("updateOrganizationMemberRole", async () => {
    const context = await requireRole(["OrgAdmin"]);
    const parsed = updateRoleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid role payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const member = await prisma.organizationMember.findFirst({
      where: {
        id: parsed.data.memberId,
        orgId: context.orgId,
      },
    });

    if (!member) {
      throw new AppError("Organization member not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.organizationMember.update({
      where: {
        id: member.id,
      },
      data: {
        role: parsed.data.role,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ROLE_CHANGED",
      entityType: "OrganizationMember",
      entityId: member.id,
      beforeData: {
        role: member.role,
      },
      afterData: {
        role: updated.role,
      },
    });

    return {
      memberId: member.id,
      role: updated.role,
    };
  });
}

export async function updateAgentCapacity(input: unknown) {
  return runSafeAction("updateAgentCapacity", async () => {
    const context = await requireRole(["OrgAdmin", "Agent"]);
    const parsed = updateCapacitySchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid capacity payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const member = await prisma.organizationMember.findFirst({
      where: {
        id: parsed.data.memberId,
        orgId: context.orgId,
      },
    });

    if (!member) {
      throw new AppError("Organization member not found", "NOT_FOUND", 404);
    }

    if (context.role === "Agent" && member.userId !== context.userId) {
      throw new AppError("Agents can only update their own capacity", "FORBIDDEN", 403);
    }

    const updated = await prisma.organizationMember.update({
      where: { id: member.id },
      data: {
        agentCapacity: parsed.data.agentCapacity,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "AGENT_CAPACITY_UPDATED",
      entityType: "OrganizationMember",
      entityId: member.id,
      metadata: {
        agentCapacity: updated.agentCapacity,
      },
    });

    return {
      memberId: member.id,
      agentCapacity: updated.agentCapacity,
    };
  });
}

export async function createTeam(input: unknown) {
  return runSafeAction("createTeam", async () => {
    const context = await requirePermission("users.manage");
    const parsed = teamSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid team payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const team = await prisma.team.create({
      data: {
        orgId: context.orgId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    if (parsed.data.memberIds.length) {
      const validMembers = await prisma.organizationMember.findMany({
        where: {
          orgId: context.orgId,
          id: { in: parsed.data.memberIds },
        },
        select: {
          id: true,
        },
      });

      if (validMembers.length) {
        await prisma.teamMember.createMany({
          data: validMembers.map((member) => ({
            orgId: context.orgId,
            teamId: team.id,
            memberId: member.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TEAM_CREATED",
      entityType: "Team",
      entityId: team.id,
      metadata: {
        name: team.name,
      },
    });

    return team;
  });
}

export async function addTeamMember(input: unknown) {
  return runSafeAction("addTeamMember", async () => {
    const context = await requirePermission("users.manage");
    const parsed = teamMemberSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid team member payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const team = await prisma.team.findFirst({
      where: { id: parsed.data.teamId, orgId: context.orgId },
      select: { id: true },
    });

    if (!team) {
      throw new AppError("Team not found", "NOT_FOUND", 404);
    }

    const member = await prisma.organizationMember.findFirst({
      where: { id: parsed.data.memberId, orgId: context.orgId },
      select: { id: true },
    });

    if (!member) {
      throw new AppError("Organization member not found", "NOT_FOUND", 404);
    }

    const teamMember = await prisma.teamMember.upsert({
      where: {
        teamId_memberId: {
          teamId: team.id,
          memberId: member.id,
        },
      },
      create: {
        orgId: context.orgId,
        teamId: team.id,
        memberId: member.id,
      },
      update: {},
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TEAM_MEMBER_ADDED",
      entityType: "Team",
      entityId: team.id,
      metadata: {
        memberId: member.id,
        teamMemberId: teamMember.id,
      },
    });

    return { success: true };
  });
}

export async function removeTeamMember(input: unknown) {
  return runSafeAction("removeTeamMember", async () => {
    const context = await requirePermission("users.manage");
    const parsed = teamMemberSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid team member payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    await prisma.teamMember.deleteMany({
      where: {
        orgId: context.orgId,
        teamId: parsed.data.teamId,
        memberId: parsed.data.memberId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "TEAM_MEMBER_REMOVED",
      entityType: "Team",
      entityId: parsed.data.teamId,
      metadata: {
        memberId: parsed.data.memberId,
      },
    });

    return { success: true };
  });
}
