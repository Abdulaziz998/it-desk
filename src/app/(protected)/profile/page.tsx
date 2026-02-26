import { requirePageAuthContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "@/app/(protected)/profile/profile-client";

export default async function ProfilePage() {
  const context = await requirePageAuthContext();

  const user = await prisma.user.findUnique({
    where: {
      id: context.userId,
    },
    select: {
      name: true,
      email: true,
    },
  });

  return <ProfileClient name={user?.name ?? ""} email={user?.email ?? context.email} />;
}
