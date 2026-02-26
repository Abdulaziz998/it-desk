"use server";

import { requirePermission } from "@/lib/auth/context";
import { runSafeAction } from "@/server/action-utils";
import { enqueueNotificationFlushJob, enqueueSlaScanJob, enqueueWorkflowJob } from "@/lib/jobs/enqueue";
import { prisma } from "@/lib/prisma";
import { effectivePlan, hasFeature } from "@/lib/billing/plans";
import { AppError } from "@/lib/errors";

async function assertJobsFeatureEnabled(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, planStatus: true },
  });

  const plan = org ? effectivePlan(org.plan, org.planStatus) : "FREE";
  if (!hasFeature(plan, "jobs")) {
    throw new AppError("Pro plan required for background jobs", "PLAN_GATED", 403);
  }
}

export async function enqueueSlaScanNow() {
  return runSafeAction("enqueueSlaScanNow", async () => {
    const context = await requirePermission("settings.manage");
    await assertJobsFeatureEnabled(context.orgId);
    const job = await enqueueSlaScanJob({
      orgId: context.orgId,
      triggeredById: context.userId,
    });

    return {
      jobId: job.id,
      queue: "sla",
    };
  });
}

export async function enqueueWorkflowRunNow() {
  return runSafeAction("enqueueWorkflowRunNow", async () => {
    const context = await requirePermission("settings.manage");
    await assertJobsFeatureEnabled(context.orgId);
    const job = await enqueueWorkflowJob({
      triggeredById: context.userId,
    });

    return {
      jobId: job.id,
      queue: "workflows",
    };
  });
}

export async function enqueueNotificationsFlushNow() {
  return runSafeAction("enqueueNotificationsFlushNow", async () => {
    const context = await requirePermission("settings.manage");
    await assertJobsFeatureEnabled(context.orgId);
    const job = await enqueueNotificationFlushJob({
      orgId: context.orgId,
    });

    return {
      jobId: job.id,
      queue: "notifications",
    };
  });
}
