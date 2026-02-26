import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

export default async function IntegrationLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePagePermission("auditLogs.read");
  const params = await searchParams;

  const provider = typeof params.provider === "string" ? params.provider : "";
  const status = typeof params.status === "string" ? params.status : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";

  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;

  const logs = await prisma.integrationActionLog.findMany({
    where: {
      orgId: context.orgId,
      provider: provider === "entra" ? "entra" : undefined,
      status: status === "SUCCESS" || status === "FAILED" ? status : undefined,
      createdAt: fromDate || toDate ? { gte: fromDate, lte: toDate } : undefined,
    },
    include: {
      accessRequest: {
        select: {
          id: true,
          title: true,
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
          <CardTitle>Integration log filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-5">
            <Select name="provider" defaultValue={provider}>
              <option value="">All providers</option>
              <option value="entra">Entra</option>
            </Select>
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </Select>
            <Input type="date" name="from" defaultValue={from} />
            <Input type="date" name="to" defaultValue={to} />
            <div className="flex gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild variant="outline">
                <Link href="/admin/integrations/logs">Reset</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded border border-slate-200 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {log.provider} - {log.action} - {log.status}
                  </span>
                  <span>{formatDate(log.createdAt)}</span>
                </div>
                <p className="text-slate-700">{log.message}</p>
                <p className="text-xs text-slate-500">
                  Target UPN: {log.targetUpn ?? "n/a"} | Target Group: {log.targetGroupId ?? "n/a"}
                </p>
                {log.accessRequest ? (
                  <Link className="text-xs text-sky-700 hover:underline" href={`/access-requests#access-request-${log.accessRequest.id}`}>
                    Related access request: {log.accessRequest.title}
                  </Link>
                ) : null}
              </li>
            ))}
            {!logs.length ? <li className="text-sm text-slate-500">No integration logs for this filter.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
