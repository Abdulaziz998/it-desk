import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/jobs/redis";
import type { NotificationDispatchJobData, NotificationFlushJobData, SlaScanJobData, WorkflowJobData } from "@/lib/jobs/types";

export const QUEUE_NAMES = {
  sla: "itopsdesk-sla",
  notifications: "itopsdesk-notifications",
  workflows: "itopsdesk-workflows",
} as const;

export const slaQueue = new Queue<SlaScanJobData>(QUEUE_NAMES.sla, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 2,
  },
});

export const workflowsQueue = new Queue<WorkflowJobData>(QUEUE_NAMES.workflows, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 2,
  },
});

export const notificationsQueue = new Queue<NotificationDispatchJobData | NotificationFlushJobData>(QUEUE_NAMES.notifications, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
    attempts: 2,
  },
});
