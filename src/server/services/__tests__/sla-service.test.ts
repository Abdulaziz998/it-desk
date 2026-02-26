import { describe, expect, test } from "vitest";
import { calculateSlaFlags } from "@/server/services/sla-service";

describe("calculateSlaFlags", () => {
  test("marks at-risk within four hours", () => {
    const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = calculateSlaFlags(dueAt);

    expect(result.atRisk).toBe(true);
    expect(result.breachedAt).toBeNull();
  });

  test("marks breached after due time", () => {
    const dueAt = new Date(Date.now() - 60 * 1000);
    const result = calculateSlaFlags(dueAt);

    expect(result.atRisk).toBe(false);
    expect(result.breachedAt).toBeInstanceOf(Date);
  });
});
