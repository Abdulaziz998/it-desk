import { prisma } from "@/lib/prisma";
import { applyAutoAssignRule } from "@/server/services/auto-assign";
import { calculateSlaFlags } from "@/server/services/sla-service";
import { enqueueNotificationDispatchJob } from "@/lib/jobs/enqueue";
import type { TicketStatus } from "@prisma/client";

const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

function uniqueUserIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter(Boolean) as string[]));
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export type WorkflowOrgResult = {
  orgId: string;
  status: "SUCCESS" | "FAILED";
  message: string;
  scanned: number;
  assignedCount: number;
  atRiskEscalations: number;
  breachedEscalations: number;
};

export async function runWorkflowAutomationForOrg(orgId: string, triggeredById?: string): Promise<WorkflowOrgResult> {
  let runId: string | null = null;

  try {
    const run = await prisma.workflowRun.create({
      data: {
        orgId,
        runType: "BULLMQ",
        status: "RUNNING",
        triggeredById,
      },
    });
    runId = run.id;
  } catch (error) {
    const message = asErrorMessage(error);

    if (message.includes("WorkflowRun_orgId_fkey") || message.toLowerCase().includes("foreign key constraint")) {
      return {
        orgId,
        status: "FAILED",
        message: `WorkflowRun create failed (FK): ${message}`,
        scanned: 0,
        assignedCount: 0,
        atRiskEscalations: 0,
        breachedEscalations: 0,
      };
    }

    return {
      orgId,
      status: "FAILED",
      message: `WorkflowRun create failed: ${message}`,
      scanned: 0,
      assignedCount: 0,
      atRiskEscalations: 0,
      breachedEscalations: 0,
    };
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        orgId,
        status: {
          in: ACTIVE_TICKET_STATUSES,
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
    let atRiskEscalations = 0;
    let breachedEscalations = 0;

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
          currentTicket =
            (await prisma.ticket.findUnique({
              where: {
                id: ticket.id,
              },
              include: {
                watchers: {
                  select: {
                    userId: true,
                  },
                },
              },
            })) ?? currentTicket;

          await enqueueNotificationDispatchJob({
            orgId,
            userIds: uniqueUserIds([assignment.assigneeId, currentTicket.requesterId]),
            type: "ASSIGNMENT",
            title: `Assigned: ${currentTicket.key}`,
            message: currentTicket.title,
            link: `/tickets/${currentTicket.id}`,
            metadata: {
              ticketId: currentTicket.id,
              source: "workflow.auto_assign",
            },
          });
        }
      }

      const previousAtRisk = currentTicket.atRisk;
      const previousBreachedAt = currentTicket.breachedAt;
      const slaFlags = calculateSlaFlags(currentTicket.dueAt, currentTicket.breachedAt);

      const statusChanged = slaFlags.atRisk !== currentTicket.atRisk || slaFlags.breachedAt?.getTime() !== currentTicket.breachedAt?.getTime();
      if (statusChanged) {
        currentTicket = await prisma.ticket.update({
          where: { id: currentTicket.id },
          data: {
            atRisk: slaFlags.atRisk,
            breachedAt: slaFlags.breachedAt,
          },
          include: {
            watchers: {
              select: {
                userId: true,
              },
            },
          },
        });
      }

      const watchers = await prisma.ticketWatcher.findMany({
        where: {
          ticketId: currentTicket.id,
        },
        select: {
          userId: true,
        },
      });

      const escalationRecipients = uniqueUserIds([
        ...watchers.map((watcher) => watcher.userId),
        currentTicket.assigneeId,
        currentTicket.requesterId,
      ]);

      if (!previousAtRisk && slaFlags.atRisk) {
        atRiskEscalations += 1;
        await enqueueNotificationDispatchJob({
          orgId,
          userIds: escalationRecipients,
          type: "SLA_AT_RISK",
          title: `SLA at risk: ${currentTicket.key}`,
          message: currentTicket.title,
          link: `/tickets/${currentTicket.id}`,
          metadata: {
            ticketId: currentTicket.id,
            source: "workflow.escalation",
          },
        });
      }

      if (!previousBreachedAt && slaFlags.breachedAt) {
        breachedEscalations += 1;
        await enqueueNotificationDispatchJob({
          orgId,
          userIds: escalationRecipients,
          type: "SLA_BREACHED",
          title: `SLA breached: ${currentTicket.key}`,
          message: currentTicket.title,
          link: `/tickets/${currentTicket.id}`,
          metadata: {
            ticketId: currentTicket.id,
            source: "workflow.escalation",
          },
        });
      }
    }

    const summary = {
      scanned: tickets.length,
      assignedCount,
      atRiskEscalations,
      breachedEscalations,
    };

    await prisma.workflowRun.update({
      where: {
        id: runId,
      },
      data: {
        status: "COMPLETED",
        summary: JSON.stringify(summary),
        finishedAt: new Date(),
      },
    });

    return {
      orgId,
      status: "SUCCESS",
      message: "Workflow automation completed",
      ...summary,
    };
  } catch (error) {
    const message = asErrorMessage(error);

    if (runId) {
      await prisma.workflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "FAILED",
          summary: JSON.stringify({ error: message }),
          finishedAt: new Date(),
        },
      });
    }

    return {
      orgId,
      status: "FAILED",
      message: `Workflow automation failed: ${message}`,
      scanned: 0,
      assignedCount: 0,
      atRiskEscalations: 0,
      breachedEscalations: 0,
    };
  }
}
