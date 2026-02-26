import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { JobsClient } from "@/app/(protected)/admin/jobs/jobs-client";

export default async function AdminJobsPage() {
  const context = await requirePagePermission("settings.manage");

  const runs = await prisma.jobRun.findMany({
    where: {
      OR: [{ orgId: context.orgId }, { orgId: null }],
    },
    orderBy: {
      startedAt: "desc",
    },
    take: 20,
  });

  return (
    <JobsClient
      runs={runs.map((run) => ({
        id: run.id,
        jobType: run.jobType,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        message: run.message,
      }))}
    />
  );
}
