"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/context";
import { runSafeAction } from "@/server/action-utils";

const markReadSchema = z.object({
  notificationId: z.string(),
});

export async function markNotificationRead(input: unknown) {
  return runSafeAction("markNotificationRead", async () => {
    const context = await requirePermission("ticket.read");
    const parsed = markReadSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid notification payload", "VALIDATION_ERROR", 400);
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: parsed.data.notificationId,
        orgId: context.orgId,
        userId: context.userId,
      },
    });

    if (!notification) {
      throw new AppError("Notification not found", "NOT_FOUND", 404);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true };
  });
}

export async function markAllNotificationsRead() {
  return runSafeAction("markAllNotificationsRead", async () => {
    const context = await requirePermission("ticket.read");

    const result = await prisma.notification.updateMany({
      where: {
        orgId: context.orgId,
        userId: context.userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  });
}
