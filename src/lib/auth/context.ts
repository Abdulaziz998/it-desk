import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AppError } from "@/lib/errors";
import { hasPermission, type Permission, type Role } from "@/lib/auth/permissions";

export type AuthContext = {
  userId: string;
  email: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: Role;
  membershipId: string;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id || !user.orgId || !user.membershipId || !user.role || !user.email || !user.orgSlug || !user.orgName) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    orgId: user.orgId,
    orgSlug: user.orgSlug,
    orgName: user.orgName,
    role: user.role,
    membershipId: user.membershipId,
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();
  if (!context) {
    throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  }
  return context;
}

export async function requirePageAuthContext() {
  const context = await getAuthContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

export async function requireRole(roles: Role[]) {
  const context = await requireAuthContext();
  if (!roles.includes(context.role)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return context;
}

export async function requirePermission(permission: Permission) {
  const context = await requireAuthContext();
  if (!(await hasPermission(context.role, permission))) {
    throw new AppError("Forbidden", "FORBIDDEN", 403, { permission });
  }
  return context;
}

export async function requirePagePermission(permission: Permission) {
  const context = await requirePageAuthContext();
  if (!(await hasPermission(context.role, permission))) {
    redirect("/dashboard?forbidden=1");
  }
  return context;
}
