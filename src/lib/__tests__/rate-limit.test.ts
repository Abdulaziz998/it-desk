import { describe, expect, test, vi } from "vitest";
import { InMemoryRateLimiter } from "@/lib/rate-limit";

describe("InMemoryRateLimiter", () => {
  test("allows requests until max then blocks", () => {
    const limiter = new InMemoryRateLimiter(2, 1000);

    expect(limiter.check("client-a").allowed).toBe(true);
    expect(limiter.check("client-a").allowed).toBe(true);
    expect(limiter.check("client-a").allowed).toBe(false);
  });

  test("resets after window", () => {
    vi.useFakeTimers();

    const limiter = new InMemoryRateLimiter(1, 1000);
    expect(limiter.check("client-b").allowed).toBe(true);
    expect(limiter.check("client-b").allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.check("client-b").allowed).toBe(true);

    vi.useRealTimers();
  });
});
