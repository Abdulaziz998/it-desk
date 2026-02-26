import { prisma } from "@/lib/prisma";

export async function computeDueAt(orgId: string, priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", startDate = new Date()) {
  const rule = await prisma.slaRule.findUnique({
    where: {
      orgId_priority: {
        orgId,
        priority,
      },
    },
  });

  if (!rule) return null;

  return new Date(startDate.getTime() + rule.resolutionMinutes * 60 * 1000);
}

export function calculateSlaFlags(dueAt: Date | null, previousBreachedAt: Date | null = null) {
  if (!dueAt) {
    return {
      atRisk: false,
      breachedAt: previousBreachedAt,
    };
  }

  const now = Date.now();
  const dueMs = dueAt.getTime();
  const hoursUntilDue = (dueMs - now) / (1000 * 60 * 60);

  const breached = now > dueMs;
  return {
    atRisk: !breached && hoursUntilDue <= 4,
    breachedAt: breached ? previousBreachedAt ?? new Date() : previousBreachedAt,
  };
}
