import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { runOrgWorkflows } from "@/server/services/workflow-runner";
import { logger } from "@/lib/logger";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id || !user.orgId || !user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await hasPermission(user.role, "settings.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await runOrgWorkflows(user.orgId, user.id);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    logger.error("Workflow run endpoint failed", error, {
      userId: user.id,
      orgId: user.orgId,
    });
    return NextResponse.json({ error: "Workflow run failed" }, { status: 500 });
  }
}
