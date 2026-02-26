import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "it-opsdesk",
      db: "up",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        service: "it-opsdesk",
        db: "down",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
