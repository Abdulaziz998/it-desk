import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "@/app/(protected)/notifications/notifications-client";

export default async function NotificationsPage() {
  const context = await requirePagePermission("ticket.read");

  const notifications = await prisma.notification.findMany({
    where: {
      orgId: context.orgId,
      userId: context.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return (
    <NotificationsClient
      notifications={notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      }))}
    />
  );
}
