import { notificationsQueue, slaQueue, workflowsQueue } from "@/lib/jobs/queues";
import type { NotificationDispatchJobData, NotificationFlushJobData, SlaScanJobData, WorkflowJobData } from "@/lib/jobs/types";

export async function enqueueSlaScanJob(data: SlaScanJobData = {}) {
  return slaQueue.add("sla.scan", data, {
    jobId: `sla-${data.orgId ?? "all"}-${Date.now()}`,
  });
}

export async function enqueueWorkflowJob(data: WorkflowJobData = {}) {
  return workflowsQueue.add("workflows.run", data, {
    jobId: `workflow-all-${Date.now()}`,
  });
}

export async function enqueueNotificationDispatchJob(data: NotificationDispatchJobData) {
  return notificationsQueue.add("notifications.dispatch", data);
}

export async function enqueueNotificationFlushJob(data: NotificationFlushJobData = {}) {
  return notificationsQueue.add("notifications.flush", data, {
    jobId: `notifications-flush-${data.orgId ?? "all"}-${Date.now()}`,
  });
}
