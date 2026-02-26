import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAMES } from "@/lib/jobs/queues";
import { ensureRedisConnection, getRedisConnection } from "@/lib/jobs/redis";
import type { NotificationDispatchJobData, NotificationFlushJobData } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";
import { completeJobRun, failJobRun, startJobRun } from "@/server/jobs/job-run-service";
import { processNotificationDispatchJob, processNotificationFlushJob } from "@/server/jobs/notification-job";

type NotificationWorkerData = NotificationDispatchJobData | NotificationFlushJobData;

async function startWorker() {
  await ensureRedisConnection();

  const worker = new Worker<NotificationWorkerData>(
    QUEUE_NAMES.notifications,
    async (job) => {
      const run = await startJobRun({
        orgId: "orgId" in job.data ? job.data.orgId : undefined,
        jobType: job.name,
        message: `Notifications job ${job.id}`,
      });

      try {
        if (job.name === "notifications.dispatch") {
          const result = await processNotificationDispatchJob(job.data as NotificationDispatchJobData);
          await completeJobRun({
            id: run.id,
            status: "SUCCESS",
            message: "Notification dispatch completed",
            jsonResult: result,
          });
          return result;
        }

        if (job.name === "notifications.flush") {
          const result = await processNotificationFlushJob(job.data as NotificationFlushJobData);
          await completeJobRun({
            id: run.id,
            status: "SUCCESS",
            message: "Notification flush completed",
            jsonResult: result,
          });
          return result;
        }

        throw new Error(`Unknown notification job: ${job.name}`);
      } catch (error) {
        await failJobRun(run.id, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info("Notifications worker completed job", {
      queue: QUEUE_NAMES.notifications,
      jobId: job.id,
      name: job.name,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Notifications worker failed job", error, {
      queue: QUEUE_NAMES.notifications,
      jobId: job?.id,
      name: job?.name,
    });
  });

  logger.info("Notifications worker started", {
    queue: QUEUE_NAMES.notifications,
    redisUrl: process.env.REDIS_URL?.trim() || "redis://localhost:6379",
  });
}

void startWorker().catch((error) => {
  logger.error("Notifications worker startup failed", error, {
    queue: QUEUE_NAMES.notifications,
  });
  process.exit(1);
});
