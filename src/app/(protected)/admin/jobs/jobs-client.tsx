"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { enqueueNotificationsFlushNow, enqueueSlaScanNow, enqueueWorkflowRunNow } from "@/server/actions/job-actions";
import Link from "next/link";

type JobsClientProps = {
  canUseJobs: boolean;
  runs: Array<{
    id: string;
    jobType: string;
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    message: string | null;
  }>;
};

function formatDuration(startedAt: Date, finishedAt: Date | null) {
  if (!finishedAt) {
    return "Running";
  }

  const durationMs = finishedAt.getTime() - startedAt.getTime();
  return `${Math.max(0, Math.round(durationMs / 1000))}s`;
}

export function JobsClient({ canUseJobs, runs }: JobsClientProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"sla" | "workflow" | "notifications" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "sla" | "workflow" | "notifications") {
    setPending(action);
    setMessage(null);
    setError(null);

    const result =
      action === "sla"
        ? await enqueueSlaScanNow()
        : action === "workflow"
          ? await enqueueWorkflowRunNow()
          : await enqueueNotificationsFlushNow();

    setPending(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Queued ${result.data.queue} job (${result.data.jobId}).`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run background jobs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canUseJobs ? (
            <>
              <Button onClick={() => run("sla")} disabled={pending !== null}>
                {pending === "sla" ? "Queueing..." : "Enqueue SLA scan"}
              </Button>
              <Button variant="outline" onClick={() => run("workflow")} disabled={pending !== null}>
                {pending === "workflow" ? "Queueing..." : "Enqueue workflow run"}
              </Button>
              <Button variant="outline" onClick={() => run("notifications")} disabled={pending !== null}>
                {pending === "notifications" ? "Queueing..." : "Enqueue notifications flush"}
              </Button>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-amber-700">Background jobs are available on the Pro plan.</p>
              <Button asChild>
                <Link href="/settings/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent job runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{run.jobType}</td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2">{formatDate(run.startedAt)}</td>
                    <td className="px-3 py-2">{formatDuration(run.startedAt, run.finishedAt)}</td>
                    <td className="px-3 py-2 text-slate-600">{run.message ?? "-"}</td>
                  </tr>
                ))}
                {!runs.length ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={5}>
                      No job runs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  );
}
