import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { JobsClient } from "@/app/(protected)/admin/jobs/jobs-client";
import { effectivePlan, hasFeature } from "@/lib/billing/plans";

export default async function AdminJobsPage() {
  const context = await requirePagePermission("settings.manage");

  const [org, runs] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: context.orgId },
      select: { plan: true, planStatus: true },
    }),
    prisma.jobRun.findMany({
      where: {
        OR: [{ orgId: context.orgId }, { orgId: null }],
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 20,
    }),
  ]);

  const plan = org ? effectivePlan(org.plan, org.planStatus) : "FREE";
  const canUseJobs = hasFeature(plan, "jobs");

  return (
    <JobsClient
      canUseJobs={canUseJobs}
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
