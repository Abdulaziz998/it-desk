import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export type { Role } from "@prisma/client";

export const permissionCatalog = [
  { key: "ticket.read", description: "Read tickets" },
  { key: "ticket.write", description: "Create and update tickets" },
  { key: "ticket.assign", description: "Assign tickets" },
  { key: "kb.read", description: "Read knowledge articles" },
  { key: "kb.write", description: "Create and edit knowledge articles" },
  { key: "assets.read", description: "Read assets" },
  { key: "assets.write", description: "Create and update assets" },
  { key: "accessRequests.approve", description: "Approve access requests" },
  { key: "accessRequests.execute", description: "Create and execute access requests" },
  { key: "settings.manage", description: "Manage organization settings" },
  { key: "users.manage", description: "Manage users and teams" },
  { key: "auditLogs.read", description: "Read audit logs" },
  { key: "metrics.read", description: "Read metrics and dashboards" },
] as const;

export type Permission = (typeof permissionCatalog)[number]["key"];

const globalForPermissions = globalThis as unknown as {
  permissionMatrixCache?: {
    expiresAt: number;
    matrix: Record<Role, Set<Permission>>;
  };
};

const CACHE_TTL_MS = 30_000;

function emptyMatrix() {
  return {
    OrgAdmin: new Set<Permission>(),
    Agent: new Set<Permission>(),
    Requester: new Set<Permission>(),
    ReadOnly: new Set<Permission>(),
  } satisfies Record<Role, Set<Permission>>;
}

async function buildPermissionMatrix() {
  const rows = await prisma.rolePermission.findMany({
    include: {
      permission: {
        select: {
          key: true,
        },
      },
    },
  });

  const matrix = emptyMatrix();

  for (const row of rows) {
    matrix[row.role].add(row.permission.key as Permission);
  }

  return matrix;
}

export function hasPermissionInMatrix(matrix: Record<Role, Set<Permission>>, role: Role, permission: Permission) {
  return matrix[role].has(permission);
}

export async function getRolePermissionMatrix() {
  const now = Date.now();
  const cached = globalForPermissions.permissionMatrixCache;

  if (cached && cached.expiresAt > now) {
    return cached.matrix;
  }

  const matrix = await buildPermissionMatrix();
  globalForPermissions.permissionMatrixCache = {
    expiresAt: now + CACHE_TTL_MS,
    matrix,
  };

  return matrix;
}

export async function hasPermission(role: Role, permission: Permission) {
  const matrix = await getRolePermissionMatrix();
  return hasPermissionInMatrix(matrix, role, permission);
}

export function clearPermissionMatrixCache() {
  globalForPermissions.permissionMatrixCache = undefined;
}
