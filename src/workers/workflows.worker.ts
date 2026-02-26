import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAMES } from "@/lib/jobs/queues";
import { ensureRedisConnection, getRedisConnection } from "@/lib/jobs/redis";
import type { WorkflowJobData } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { completeJobRun, startJobRun } from "@/server/jobs/job-run-service";
import { runWorkflowAutomationForOrg } from "@/server/jobs/workflow-job";

async function startWorker() {
  await ensureRedisConnection();

  const worker = new Worker<WorkflowJobData>(
    QUEUE_NAMES.workflows,
    async (job) => {
      const run = await startJobRun({
        jobType: "workflows.run",
        message: `Workflow automation job ${job.id}`,
      });

      const organizations = await prisma.organization.findMany({
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (!organizations.length) {
        await completeJobRun({
          id: run.id,
          status: "SUCCESS",
          message: "No organizations found",
          jsonResult: [],
        });

        logger.info("Workflow job completed with no organizations", {
          jobId: job.id,
          queue: QUEUE_NAMES.workflows,
        });

        return [];
      }

      const results = [];
      for (const organization of organizations) {
        results.push(await runWorkflowAutomationForOrg(organization.id, job.data.triggeredById));
      }

      const failed = results.filter((result) => result.status === "FAILED");
      if (failed.length) {
        const message = `Workflow run finished with ${failed.length} failed org(s)`;
        await completeJobRun({
          id: run.id,
          status: "FAILED",
          message,
          jsonResult: results,
        });

        logger.warn(message, {
          jobId: job.id,
          failedOrgIds: failed.map((item) => item.orgId),
        });

        return results;
      }

      await completeJobRun({
        id: run.id,
        status: "SUCCESS",
        message: `Workflow run completed for ${results.length} org(s)`,
        jsonResult: results,
      });

      return results;
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    logger.info("Workflows worker completed job", {
      queue: QUEUE_NAMES.workflows,
      jobId: job.id,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Workflows worker failed job", error, {
      queue: QUEUE_NAMES.workflows,
      jobId: job?.id,
    });
  });

  logger.info("Workflows worker started", {
    queue: QUEUE_NAMES.workflows,
    redisUrl: process.env.REDIS_URL?.trim() || "redis://localhost:6379",
  });
}

void startWorker().catch((error) => {
  logger.error("Workflows worker startup failed", error, {
    queue: QUEUE_NAMES.workflows,
  });
  process.exit(1);
});
