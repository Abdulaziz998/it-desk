import { Prisma } from "@prisma/client";
import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { TicketCreateForm } from "@/app/(protected)/tickets/ticket-create-form";
import { TicketListClient } from "@/app/(protected)/tickets/ticket-list-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function buildWhere(orgId: string, searchParams: Record<string, string | string[] | undefined>): Prisma.TicketWhereInput {
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const priority = typeof searchParams.priority === "string" ? searchParams.priority : undefined;
  const assigneeId = typeof searchParams.assigneeId === "string" ? searchParams.assigneeId : undefined;
  const requesterId = typeof searchParams.requesterId === "string" ? searchParams.requesterId : undefined;
  const categoryId = typeof searchParams.categoryId === "string" ? searchParams.categoryId : undefined;
  const tagId = typeof searchParams.tagId === "string" ? searchParams.tagId : undefined;
  const dateFrom = typeof searchParams.dateFrom === "string" ? searchParams.dateFrom : undefined;
  const dateTo = typeof searchParams.dateTo === "string" ? searchParams.dateTo : undefined;

  const where: Prisma.TicketWhereInput = {
    orgId,
  };

  if (status) where.status = status as Prisma.EnumTicketStatusFilter["equals"];
  if (priority) where.priority = priority as Prisma.EnumTicketPriorityFilter["equals"];
  if (assigneeId) where.assigneeId = assigneeId;
  if (requesterId) where.requesterId = requesterId;
  if (categoryId) where.categoryId = categoryId;
  if (tagId) {
    where.tags = {
      some: {
        tagId,
      },
    };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59`);
  }

  return where;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePagePermission("ticket.read");
  const params = await searchParams;

  const where = buildWhere(context.orgId, params);

  const [tickets, members, categories, teams, tags, assets, articles] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        assignee: { select: { name: true } },
        requester: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.organizationMember.findMany({
      where: { orgId: context.orgId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.category.findMany({ where: { orgId: context.orgId }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ where: { orgId: context.orgId }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ where: { orgId: context.orgId }, orderBy: { name: "asc" } }),
    prisma.asset.findMany({ where: { orgId: context.orgId }, orderBy: { assetTag: "asc" } }),
    prisma.knowledgeArticle.findMany({
      where: { orgId: context.orgId, isPublished: true },
      select: { id: true, title: true, slug: true, categoryId: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  const ticketRows = tickets.map((ticket) => ({
    id: ticket.id,
    key: ticket.key,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    assigneeName: ticket.assignee?.name ?? "Unassigned",
    requesterName: ticket.requester.name ?? "Unknown",
    categoryName: ticket.category?.name ?? "-",
    dueAt: ticket.dueAt,
    atRisk: ticket.atRisk,
    breachedAt: ticket.breachedAt,
  }));

  const users = members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    role: member.role,
  }));

  return (
    <div className="space-y-6">
      <TicketCreateForm
        users={users}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name, keywords: category.keywords }))}
        assets={assets.map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name }))}
        tags={tags.map((tag) => ({ id: tag.id, name: tag.name }))}
        suggestedArticles={articles}
      />

      <Card>
        <CardHeader>
          <CardTitle>Ticket filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-5">
            <Select name="status" defaultValue={typeof params.status === "string" ? params.status : ""}>
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="ON_HOLD">On hold</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>

            <Select name="priority" defaultValue={typeof params.priority === "string" ? params.priority : ""}>
              <option value="">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>

            <Select name="assigneeId" defaultValue={typeof params.assigneeId === "string" ? params.assigneeId : ""}>
              <option value="">All assignees</option>
              {users
                .filter((user) => user.role === "Agent" || user.role === "OrgAdmin")
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? "Unnamed"}
                  </option>
                ))}
            </Select>

            <Select name="requesterId" defaultValue={typeof params.requesterId === "string" ? params.requesterId : ""}>
              <option value="">All requesters</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? "Unnamed"}
                </option>
              ))}
            </Select>

            <Select name="categoryId" defaultValue={typeof params.categoryId === "string" ? params.categoryId : ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>

            <Select name="tagId" defaultValue={typeof params.tagId === "string" ? params.tagId : ""}>
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>

            <Input type="date" name="dateFrom" defaultValue={typeof params.dateFrom === "string" ? params.dateFrom : ""} />
            <Input type="date" name="dateTo" defaultValue={typeof params.dateTo === "string" ? params.dateTo : ""} />

            <div className="flex items-center gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild variant="outline">
                <Link href="/tickets">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <TicketListClient
        tickets={ticketRows}
        assignees={users
          .filter((user) => user.role === "Agent" || user.role === "OrgAdmin")
          .map((user) => ({ id: user.id, name: user.name }))}
      />
    </div>
  );
}
