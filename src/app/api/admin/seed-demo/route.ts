import { NextRequest, NextResponse } from "next/server";
import { seedDemoData } from "@/server/demo/seed-demo";
import { logger } from "@/lib/logger";

function getAdminSecretFromRequest(request: NextRequest) {
  const headerValue = request.headers.get("x-admin-secret");
  if (headerValue) {
    return headerValue;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.ADMIN_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "ADMIN_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = getAdminSecretFromRequest(request);
  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedDemoData();
    return NextResponse.json({
      ok: true,
      counts: result.counts,
      demoPassword: result.demoPassword,
    });
  } catch (error) {
    logger.error("Demo seed endpoint failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
