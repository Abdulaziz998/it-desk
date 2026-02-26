type Entry = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly store = new Map<string, Entry>();

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  check(key: string) {
    const now = Date.now();
    const current = this.store.get(key);

    if (!current || current.resetAt <= now) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.max - 1, resetAt: now + this.windowMs };
    }

    if (current.count >= this.max) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    this.store.set(key, current);
    return { allowed: true, remaining: this.max - current.count, resetAt: current.resetAt };
  }
}

export const authRateLimiter = new InMemoryRateLimiter(25, 10 * 60 * 1000);

export function getRequestIP(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
