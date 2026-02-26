import { subDays } from "date-fns";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MetricsPage() {
  const context = await requirePagePermission("metrics.read");

  const since = subDays(new Date(), 7);

  const [ticketCount, ticketCreated7d, ticketResolved7d, comments7d, accessRequests7d, kbFeedback7d, notifications7d, audit7d] =
    await Promise.all([
      prisma.ticket.count({ where: { orgId: context.orgId } }),
      prisma.ticket.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.ticket.count({ where: { orgId: context.orgId, resolvedAt: { gte: since } } }),
      prisma.ticketComment.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.accessRequest.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.knowledgeFeedback.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.notification.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { orgId: context.orgId, createdAt: { gte: since } } }),
    ]);

  const metrics = [
    ["Total tickets", ticketCount],
    ["Tickets created (7d)", ticketCreated7d],
    ["Tickets resolved (7d)", ticketResolved7d],
    ["Comments (7d)", comments7d],
    ["Access requests (7d)", accessRequests7d],
    ["KB feedback (7d)", kbFeedback7d],
    ["Notifications created (7d)", notifications7d],
    ["Audit events (7d)", audit7d],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
