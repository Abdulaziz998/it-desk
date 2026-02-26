import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { AssetsClient } from "@/app/(protected)/assets/assets-client";

export default async function AssetsPage() {
  const context = await requirePagePermission("assets.read");

  const [assets, members] = await Promise.all([
    prisma.asset.findMany({
      where: {
        orgId: context.orgId,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.organizationMember.findMany({
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
    }),
  ]);

  return (
    <AssetsClient
      assets={assets.map((asset) => ({
        id: asset.id,
        assetTag: asset.assetTag,
        type: asset.type,
        name: asset.name,
        assignedToId: asset.assignedToId,
        status: asset.status,
        purchaseDate: asset.purchaseDate,
        notes: asset.notes,
      }))}
      users={members.map((member) => ({ id: member.user.id, name: member.user.name ?? member.user.email }))}
    />
  );
}
