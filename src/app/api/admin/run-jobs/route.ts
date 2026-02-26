import { NextRequest, NextResponse } from "next/server";
import { enqueueNotificationFlushJob, enqueueSlaScanJob, enqueueWorkflowJob } from "@/lib/jobs/enqueue";
import { logger } from "@/lib/logger";

const allowedTypes = ["sla.scan", "workflows.run", "notifications.flush"] as const;

type AllowedJobType = (typeof allowedTypes)[number];

function getSecretFromRequest(request: NextRequest) {
  const headerSecret = request.headers.get("x-admin-secret");
  if (headerSecret) return headerSecret;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.ADMIN_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = getSecretFromRequest(request);
  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { jobType?: AllowedJobType; orgId?: string; triggeredById?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.jobType || !allowedTypes.includes(payload.jobType)) {
    return NextResponse.json({ error: `jobType must be one of: ${allowedTypes.join(", ")}` }, { status: 400 });
  }

  try {
    const job =
      payload.jobType === "sla.scan"
        ? await enqueueSlaScanJob({ orgId: payload.orgId, triggeredById: payload.triggeredById })
        : payload.jobType === "workflows.run"
          ? await enqueueWorkflowJob({ triggeredById: payload.triggeredById })
          : await enqueueNotificationFlushJob({ orgId: payload.orgId });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      queueName: job.queueName,
      jobType: payload.jobType,
    });
  } catch (error) {
    logger.error("Failed to enqueue admin job", error, {
      jobType: payload.jobType,
      orgId: payload.orgId,
    });

    return NextResponse.json({ error: "Failed to enqueue job" }, { status: 500 });
  }
}
