import { hasPermission } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { UsersClient } from "@/app/(protected)/users/users-client";

export default async function UsersPage() {
  const context = await requirePagePermission("users.manage");

  const members = await prisma.organizationMember.findMany({
    where: {
      orgId: context.orgId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return (
    <UsersClient
      members={members.map((member) => ({
        memberId: member.id,
        userId: member.user.id,
        name: member.user.name ?? "Unnamed",
        email: member.user.email,
        role: member.role,
        agentCapacity: member.agentCapacity,
        isCurrentUser: member.userId === context.userId,
      }))}
      canManage={(await hasPermission(context.role, "users.manage"))}
    />
  );
}
