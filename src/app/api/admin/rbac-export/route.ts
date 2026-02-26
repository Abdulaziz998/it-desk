import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { effectivePlan, hasFeature } from "@/lib/billing/plans";

export async function GET() {
  const context = await requirePermission("users.manage");

  const org = await prisma.organization.findUnique({
    where: { id: context.orgId },
    select: {
      plan: true,
      planStatus: true,
    },
  });

  const plan = org ? effectivePlan(org.plan, org.planStatus) : "FREE";
  if (!hasFeature(plan, "rbacExport")) {
    return NextResponse.json({ error: "Enterprise plan required" }, { status: 403 });
  }

  const permissions = await prisma.permission.findMany({
    include: {
      rolePermissions: true,
    },
    orderBy: { key: "asc" },
  });

  const payload = permissions.map((permission) => ({
    key: permission.key,
    description: permission.description,
    roles: permission.rolePermissions.map((rolePermission) => rolePermission.role),
  }));

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=rbac-export.json",
    },
  });
}
