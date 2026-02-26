import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePagePermission("auditLogs.read");
  const params = await searchParams;

  const action = typeof params.action === "string" ? params.action : "";
  const entityType = typeof params.entityType === "string" ? params.entityType : "";

  const logs = await prisma.auditLog.findMany({
    where: {
      orgId: context.orgId,
      action: action ? { contains: action, mode: "insensitive" } : undefined,
      entityType: entityType ? { contains: entityType, mode: "insensitive" } : undefined,
    },
    include: {
      actor: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Audit filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-4">
            <Input name="action" defaultValue={action} placeholder="Action (e.g. TICKET_UPDATED)" />
            <Input name="entityType" defaultValue={entityType} placeholder="Entity type (e.g. Ticket)" />
            <Button type="submit">Apply</Button>
            <Button asChild variant="outline">
              <a href="/admin/audit">Reset</a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log viewer</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {log.action} - {log.entityType}
                  </span>
                  <span>{formatDate(log.createdAt)}</span>
                </div>
                <p className="text-slate-700">Actor: {log.actor?.name ?? log.actor?.email ?? "System"}</p>
                {log.entityId ? <p className="text-slate-600">Entity ID: {log.entityId}</p> : null}
                {log.metadata ? <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(log.metadata, null, 2)}</pre> : null}
              </li>
            ))}
            {!logs.length ? <li className="text-sm text-slate-500">No audit entries for this filter.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
