import { describe, expect, test } from "vitest";
import { type Role } from "@prisma/client";
import { hasPermissionInMatrix, type Permission } from "@/lib/auth/permissions";

function makeMatrix(entries: Array<[Role, Permission[]]>) {
  return {
    OrgAdmin: new Set<Permission>(),
    Agent: new Set<Permission>(),
    Requester: new Set<Permission>(),
    ReadOnly: new Set<Permission>(),
    ...Object.fromEntries(entries.map(([role, permissions]) => [role, new Set(permissions)])),
  };
}

describe("permission guard logic", () => {
  test("allows role when permission exists in matrix", () => {
    const matrix = makeMatrix([["Agent", ["ticket.assign", "ticket.read"]]]);
    expect(hasPermissionInMatrix(matrix, "Agent", "ticket.assign")).toBe(true);
  });

  test("denies role when permission does not exist", () => {
    const matrix = makeMatrix([["Requester", ["ticket.read"]]]);
    expect(hasPermissionInMatrix(matrix, "Requester", "accessRequests.approve")).toBe(false);
  });

  test("supports read-only role constraints", () => {
    const matrix = makeMatrix([["ReadOnly", ["ticket.read", "kb.read", "metrics.read"]]]);
    expect(hasPermissionInMatrix(matrix, "ReadOnly", "ticket.read")).toBe(true);
    expect(hasPermissionInMatrix(matrix, "ReadOnly", "ticket.write")).toBe(false);
  });
});
