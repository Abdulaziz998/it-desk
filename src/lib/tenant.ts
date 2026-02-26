import { AppError } from "@/lib/errors";

export function withOrgScope<T extends Record<string, unknown>>(orgId: string, where?: T) {
  return {
    ...(where ?? {}),
    orgId,
  };
}

export function assertTenantOwnership(currentOrgId: string, resourceOrgId: string | null | undefined) {
  if (!resourceOrgId || currentOrgId !== resourceOrgId) {
    throw new AppError("Cross-tenant access denied", "TENANT_VIOLATION", 403);
  }
}
