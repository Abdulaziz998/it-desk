import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { authRateLimiter, getRequestIP } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

function withRateLimit(request: Request) {
  const ip = getRequestIP(request);
  const key = `${ip}:auth`;
  return authRateLimiter.check(key);
}

export async function GET(request: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const limit = withRateLimit(request);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many auth requests" }, { status: 429 });
  }
  return handler(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  const limit = withRateLimit(request);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many auth requests" }, { status: 429 });
  }
  return handler(request, context);
}
