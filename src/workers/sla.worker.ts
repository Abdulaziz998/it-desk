import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAMES } from "@/lib/jobs/queues";
import { ensureRedisConnection, getRedisConnection } from "@/lib/jobs/redis";
import type { SlaScanJobData } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";
import { completeJobRun, failJobRun, startJobRun } from "@/server/jobs/job-run-service";
import { runSlaScan } from "@/server/jobs/sla-job";

async function startWorker() {
  await ensureRedisConnection();

  const worker = new Worker<SlaScanJobData>(
    QUEUE_NAMES.sla,
    async (job) => {
      const run = await startJobRun({
        orgId: job.data.orgId,
        jobType: "sla.scan",
        message: `SLA scan job ${job.id}`,
      });

      try {
        const summary = await runSlaScan(job.data.orgId, job.data.triggeredById);
        await completeJobRun({
          id: run.id,
          status: "SUCCESS",
          message: `SLA scan completed for ${summary.length} org(s)`,
          jsonResult: summary,
        });
        return summary;
      } catch (error) {
        await failJobRun(run.id, error);
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    logger.info("SLA worker completed job", {
      queue: QUEUE_NAMES.sla,
      jobId: job.id,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("SLA worker failed job", error, {
      queue: QUEUE_NAMES.sla,
      jobId: job?.id,
    });
  });

  logger.info("SLA worker started", {
    queue: QUEUE_NAMES.sla,
    redisUrl: process.env.REDIS_URL?.trim() || "redis://localhost:6379",
  });
}

void startWorker().catch((error) => {
  logger.error("SLA worker startup failed", error, {
    queue: QUEUE_NAMES.sla,
  });
  process.exit(1);
});
