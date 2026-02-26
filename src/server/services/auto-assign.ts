import { Prisma, type AutoAssignStrategy } from "@prisma/client";

export async function applyAutoAssignRule(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    ticketId: string;
    categoryId?: string | null;
    fallbackTeamId?: string | null;
  },
) {
  const rules = await tx.autoAssignRule.findMany({
    where: {
      orgId: input.orgId,
      isActive: true,
      OR: [{ categoryId: input.categoryId ?? undefined }, { categoryId: null }],
    },
    orderBy: [{ categoryId: "desc" }, { updatedAt: "desc" }],
  });

  const chosenRule = rules[0];

  const teamId = chosenRule?.teamId ?? input.fallbackTeamId;
  if (!teamId) {
    return null;
  }

  const teamMembers = await tx.teamMember.findMany({
    where: {
      orgId: input.orgId,
      teamId,
      member: {
        role: "Agent",
      },
    },
    include: {
      member: true,
    },
    orderBy: {
      memberId: "asc",
    },
  });

  if (!teamMembers.length) {
    return null;
  }

  let selectedMember = teamMembers[0];

  const strategy: AutoAssignStrategy = chosenRule?.assignmentStrategy ?? "ROUND_ROBIN";
  if (strategy === "ROUND_ROBIN" && chosenRule) {
    const lastIdx = teamMembers.findIndex((item) => item.memberId === chosenRule.lastAssignedMemberId);
    selectedMember = teamMembers[(lastIdx + 1) % teamMembers.length] ?? teamMembers[0];

    await tx.autoAssignRule.update({
      where: { id: chosenRule.id },
      data: {
        lastAssignedMemberId: selectedMember.memberId,
      },
    });
  }

  await tx.ticket.update({
    where: { id: input.ticketId },
    data: {
      teamId,
      assigneeId: selectedMember.member.userId,
    },
  });

  return {
    teamId,
    assigneeId: selectedMember.member.userId,
    ruleId: chosenRule?.id,
  };
}
