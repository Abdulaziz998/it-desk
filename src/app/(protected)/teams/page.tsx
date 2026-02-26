import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { TeamsClient } from "@/app/(protected)/teams/teams-client";

export default async function TeamsPage() {
  const context = await requirePagePermission("users.manage");

  const [teams, members] = await Promise.all([
    prisma.team.findMany({
      where: {
        orgId: context.orgId,
      },
      include: {
        members: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.organizationMember.findMany({
      where: {
        orgId: context.orgId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    }),
  ]);

  return (
    <TeamsClient
      teams={teams.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        members: team.members.map((teamMember) => ({
          teamMemberId: teamMember.id,
          memberId: teamMember.memberId,
          name: teamMember.member.user.name ?? "Unnamed",
          role: teamMember.member.role,
        })),
      }))}
      members={members.map((member) => ({
        id: member.id,
        name: member.user.name ?? "Unnamed",
        role: member.role,
      }))}
    />
  );
}
