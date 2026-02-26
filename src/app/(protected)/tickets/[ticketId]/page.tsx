import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { TicketDetailClient } from "@/app/(protected)/tickets/[ticketId]/ticket-detail-client";

function getSeverity(status: string) {
  if (status === "OPEN") return "warning" as const;
  if (status === "RESOLVED" || status === "CLOSED") return "success" as const;
  return "info" as const;
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const context = await requirePagePermission("ticket.read");
  const { ticketId } = await params;

  const [ticket, members, teams, cannedResponses, auditLogs] = await Promise.all([
    prisma.ticket.findFirst({
      where: {
        id: ticketId,
        orgId: context.orgId,
      },
      include: {
        requester: { select: { name: true, email: true } },
        assignee: { select: { name: true, email: true } },
        team: { select: { name: true } },
        category: { select: { name: true } },
        relatedAsset: { select: { assetTag: true, name: true } },
        comments: {
          include: {
            author: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
        },
        watchers: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: { orgId: context.orgId },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.team.findMany({ where: { orgId: context.orgId }, orderBy: { name: "asc" } }),
    prisma.cannedResponse.findMany({ where: { orgId: context.orgId }, orderBy: { title: "asc" } }),
    prisma.auditLog.findMany({
      where: {
        orgId: context.orgId,
        entityType: "Ticket",
        entityId: ticketId,
      },
      include: {
        actor: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!ticket) {
    notFound();
  }

  const timeline = [
    ...ticket.comments.map((comment) => ({
      id: comment.id,
      kind: "comment" as const,
      createdAt: comment.createdAt,
      actor: comment.author.name ?? comment.author.email,
      body: comment.body,
      meta: comment.isInternal ? "Internal" : "Public",
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      kind: "audit" as const,
      createdAt: log.createdAt,
      actor: log.actor?.name ?? log.actor?.email ?? "System",
      body: log.action,
      meta: log.entityType,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>{ticket.key}</span>
            <Badge variant={getSeverity(ticket.status)}>{ticket.status}</Badge>
            <Badge>{ticket.priority}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">{ticket.title}</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>

          <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-4">
            <p>Requester: {ticket.requester.name ?? ticket.requester.email}</p>
            <p>Assignee: {ticket.assignee?.name ?? ticket.assignee?.email ?? "Unassigned"}</p>
            <p>Team: {ticket.team?.name ?? "-"}</p>
            <p>Category: {ticket.category?.name ?? "-"}</p>
            <p>Related asset: {ticket.relatedAsset ? `${ticket.relatedAsset.assetTag} - ${ticket.relatedAsset.name}` : "-"}</p>
            <p>Due at: {formatDate(ticket.dueAt)}</p>
            <p>Created at: {formatDate(ticket.createdAt)}</p>
            <p>Updated at: {formatDate(ticket.updatedAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ticket.tags.map((tagLink) => (
              <Badge key={tagLink.id}>{tagLink.tag.name}</Badge>
            ))}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Attachments (metadata)</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {ticket.attachments.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.filename} ({attachment.sizeBytes} bytes) - {attachment.url}
                </li>
              ))}
              {!ticket.attachments.length ? <li className="text-slate-500">No attachments yet.</li> : null}
            </ul>
          </div>
        </CardContent>
      </Card>

      <TicketDetailClient
        ticket={{
          id: ticket.id,
          status: ticket.status,
          priority: ticket.priority,
          assigneeId: ticket.assigneeId,
          teamId: ticket.teamId,
          dueAt: ticket.dueAt,
        }}
        members={members.map((member) => ({
          userId: member.userId,
          name: member.user.name,
          role: member.role,
        }))}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
        watchers={ticket.watchers.map((watcher) => ({ userId: watcher.user.id, name: watcher.user.name }))}
        cannedResponses={cannedResponses.map((response) => ({ id: response.id, title: response.title, content: response.content }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {timeline.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="rounded border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {item.kind.toUpperCase()} - {item.meta}
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <p className="text-sm font-medium text-slate-800">{item.actor}</p>
                <p className="text-sm text-slate-700">{item.body}</p>
              </li>
            ))}
            {!timeline.length ? <li className="text-sm text-slate-500">No timeline items yet.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
