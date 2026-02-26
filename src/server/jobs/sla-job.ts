import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { calculateSlaFlags } from "@/server/services/sla-service";
import type { TicketStatus } from "@prisma/client";

const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

export async function runSlaScanForOrg(orgId: string, actorUserId?: string) {
  const tickets = await prisma.ticket.findMany({
    where: {
      orgId,
      status: {
        in: ACTIVE_TICKET_STATUSES,
      },
      dueAt: {
        not: null,
      },
    },
    select: {
      id: true,
      key: true,
      dueAt: true,
      atRisk: true,
      breachedAt: true,
    },
    take: 2000,
  });

  let updatedCount = 0;
  let breachCount = 0;
  let atRiskCount = 0;

  for (const ticket of tickets) {
    const nextFlags = calculateSlaFlags(ticket.dueAt, ticket.breachedAt);

    const statusChanged = nextFlags.atRisk !== ticket.atRisk || nextFlags.breachedAt?.getTime() !== ticket.breachedAt?.getTime();
    if (!statusChanged) {
      continue;
    }

    await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        atRisk: nextFlags.atRisk,
        breachedAt: nextFlags.breachedAt,
      },
    });
    updatedCount += 1;

    if (nextFlags.atRisk) {
      atRiskCount += 1;
    }

    if (!ticket.breachedAt && nextFlags.breachedAt) {
      breachCount += 1;
      await recordAuditLog({
        orgId,
        actorUserId,
        action: "TICKET_SLA_BREACHED",
        entityType: "Ticket",
        entityId: ticket.id,
        metadata: {
          ticketKey: ticket.key,
          dueAt: ticket.dueAt?.toISOString(),
          breachedAt: nextFlags.breachedAt.toISOString(),
        },
      });
    }
  }

  return {
    orgId,
    scanned: tickets.length,
    updatedCount,
    atRiskCount,
    breachCount,
  };
}

export async function runSlaScan(orgId?: string, actorUserId?: string) {
  if (orgId) {
    return [await runSlaScanForOrg(orgId, actorUserId)];
  }

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const summaries = [];
  for (const org of organizations) {
    summaries.push(await runSlaScanForOrg(org.id, actorUserId));
  }

  return summaries;
}
