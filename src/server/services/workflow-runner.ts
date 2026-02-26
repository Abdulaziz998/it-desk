import { prisma } from "@/lib/prisma";
import { calculateSlaFlags } from "@/server/services/sla-service";
import { applyAutoAssignRule } from "@/server/services/auto-assign";
import { createInAppNotifications } from "@/server/services/notification-service";

export async function runOrgWorkflows(orgId: string, triggeredById?: string) {
  const run = await prisma.workflowRun.create({
    data: {
      orgId,
      runType: "MANUAL",
      status: "RUNNING",
      triggeredById,
    },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      orgId,
      status: {
        in: ["OPEN", "IN_PROGRESS", "ON_HOLD"],
      },
    },
    include: {
      watchers: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: 500,
  });

  let assignedCount = 0;
  let atRiskCount = 0;
  let breachedCount = 0;

  for (const ticket of tickets) {
    let currentTicket = ticket;

    if (!ticket.assigneeId) {
      const assignment = await prisma.$transaction(async (tx) => {
        return applyAutoAssignRule(tx, {
          orgId,
          ticketId: ticket.id,
          categoryId: ticket.categoryId,
          fallbackTeamId: ticket.teamId,
        });
      });

      if (assignment?.assigneeId) {
        assignedCount += 1;
        const updatedTicket = await prisma.ticket.findUnique({
          where: { id: ticket.id },
          include: { watchers: { select: { userId: true } } },
        });

        if (updatedTicket) {
          currentTicket = updatedTicket;
        }
      }
    }

    const slaFlags = calculateSlaFlags(currentTicket.dueAt, currentTicket.breachedAt);

    const statusChanged = slaFlags.atRisk !== currentTicket.atRisk || slaFlags.breachedAt?.getTime() !== currentTicket.breachedAt?.getTime();

    if (statusChanged) {
      await prisma.ticket.update({
        where: { id: currentTicket.id },
        data: {
          atRisk: slaFlags.atRisk,
          breachedAt: slaFlags.breachedAt,
        },
      });
    }

    if (slaFlags.atRisk) {
      atRiskCount += 1;
      await createInAppNotifications({
        orgId,
        userIds: Array.from(
          new Set(
            [
              ...currentTicket.watchers.map((watcher) => watcher.userId),
              currentTicket.assigneeId,
              currentTicket.requesterId,
            ].filter(Boolean) as string[],
          ),
        ),
        type: "SLA_AT_RISK",
        title: `SLA at risk: ${currentTicket.key}`,
        message: currentTicket.title,
        link: `/tickets/${currentTicket.id}`,
      });
    }

    if (slaFlags.breachedAt) {
      breachedCount += 1;
      await createInAppNotifications({
        orgId,
        userIds: Array.from(
          new Set(
            [
              ...currentTicket.watchers.map((watcher) => watcher.userId),
              currentTicket.assigneeId,
              currentTicket.requesterId,
            ].filter(Boolean) as string[],
          ),
        ),
        type: "SLA_BREACHED",
        title: `SLA breached: ${currentTicket.key}`,
        message: currentTicket.title,
        link: `/tickets/${currentTicket.id}`,
      });
    }
  }

  const summary = {
    scanned: tickets.length,
    assignedCount,
    atRiskCount,
    breachedCount,
  };

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      summary: JSON.stringify(summary),
      finishedAt: new Date(),
    },
  });

  return summary;
}
