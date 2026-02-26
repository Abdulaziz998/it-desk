import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/app/kpi-card";
import { SimpleBarChart } from "@/components/app/simple-bar-chart";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";

function weekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(date);
}

export default async function DashboardPage() {
  const context = await requirePagePermission("metrics.read");

  const [openTickets, unassignedTickets, atRisk, breached, agents, recentTickets] = await Promise.all([
    prisma.ticket.count({
      where: {
        orgId: context.orgId,
        status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] },
      },
    }),
    prisma.ticket.count({
      where: {
        orgId: context.orgId,
        assigneeId: null,
        status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] },
      },
    }),
    prisma.ticket.count({
      where: {
        orgId: context.orgId,
        atRisk: true,
        status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] },
      },
    }),
    prisma.ticket.count({
      where: {
        orgId: context.orgId,
        breachedAt: { not: null },
        status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] },
      },
    }),
    prisma.organizationMember.findMany({
      where: {
        orgId: context.orgId,
        role: "Agent",
      },
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.ticket.findMany({
      where: {
        orgId: context.orgId,
        OR: [
          { createdAt: { gte: subWeeks(new Date(), 8) } },
          { resolvedAt: { gte: subWeeks(new Date(), 8) } },
        ],
      },
      select: {
        createdAt: true,
        resolvedAt: true,
        status: true,
        assigneeId: true,
      },
    }),
  ]);

  const weeklyTrend = Array.from({ length: 8 }).map((_, idx) => {
    const weekStart = startOfWeek(subWeeks(new Date(), 7 - idx), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(new Date(), 7 - idx), { weekStartsOn: 1 });

    const created = recentTickets.filter((ticket) => ticket.createdAt >= weekStart && ticket.createdAt <= weekEnd).length;
    const resolved = recentTickets.filter(
      (ticket) => ticket.resolvedAt && ticket.resolvedAt >= weekStart && ticket.resolvedAt <= weekEnd,
    ).length;

    return {
      label: weekLabel(weekStart),
      value: created,
      secondaryValue: resolved,
    };
  });

  const workload = agents.map((agent) => {
    const activeCount = recentTickets.filter(
      (ticket) =>
        ticket.assigneeId === agent.userId &&
        ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(ticket.status),
    ).length;

    return {
      label: agent.user.name ?? "Unnamed",
      value: activeCount,
    };
  });

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const agingData = (() => {
    const agingBuckets = {
      "0-2d": 0,
      "3-7d": 0,
      "8-14d": 0,
      "15+d": 0,
    };

    recentTickets
      .filter((ticket) => ["OPEN", "IN_PROGRESS", "ON_HOLD"].includes(ticket.status))
      .forEach((ticket) => {
        const ageDays = (now - ticket.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays <= 2) {
          agingBuckets["0-2d"] += 1;
        } else if (ageDays <= 7) {
          agingBuckets["3-7d"] += 1;
        } else if (ageDays <= 14) {
          agingBuckets["8-14d"] += 1;
        } else {
          agingBuckets["15+d"] += 1;
        }
      });

    return Object.entries(agingBuckets).map(([label, value]) => ({ label, value }));
  })();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open tickets" value={openTickets} hint="OPEN / IN_PROGRESS / ON_HOLD" />
        <KpiCard label="Unassigned" value={unassignedTickets} hint="No assignee" />
        <KpiCard label="SLA at-risk" value={atRisk} hint="Due soon" />
        <KpiCard label="SLA breached" value={breached} hint="Past due" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tickets created vs resolved (weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-slate-500">Top bar: created, bottom bar: resolved</p>
            <SimpleBarChart data={weeklyTrend} showSecondary />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent workload</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={workload} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Ticket aging buckets</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={agingData} primaryColorClass="bg-amber-500" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
