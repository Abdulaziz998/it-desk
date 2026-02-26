"use server";

import { requirePermission } from "@/lib/auth/context";
import { runSafeAction } from "@/server/action-utils";
import { enqueueNotificationFlushJob, enqueueSlaScanJob, enqueueWorkflowJob } from "@/lib/jobs/enqueue";

export async function enqueueSlaScanNow() {
  return runSafeAction("enqueueSlaScanNow", async () => {
    const context = await requirePermission("settings.manage");
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
    const job = await enqueueNotificationFlushJob({
      orgId: context.orgId,
    });

    return {
      jobId: job.id,
      queue: "notifications",
    };
  });
}
