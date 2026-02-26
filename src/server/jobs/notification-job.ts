import { prisma } from "@/lib/prisma";
import type { NotificationDispatchJobData, NotificationFlushJobData } from "@/lib/jobs/types";
import { createInAppNotifications } from "@/server/services/notification-service";
import { Prisma } from "@prisma/client";

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export async function processNotificationDispatchJob(data: NotificationDispatchJobData) {
  await createInAppNotifications({
    orgId: data.orgId,
    userIds: data.userIds,
    type: data.type,
    title: data.title,
    message: data.message,
    link: data.link,
    metadata: data.metadata,
  });

  if (data.email) {
    const emailEntry = await prisma.emailQueue.create({
      data: {
        orgId: data.orgId,
        toEmail: data.email.toEmail,
        subject: data.email.subject,
        body: data.email.body,
        createdById: data.email.createdById,
        metadata: toJson(data.email.metadata),
      },
    });

    console.log(
      JSON.stringify({
        level: "info",
        type: "email_stub",
        orgId: data.orgId,
        to: data.email.toEmail,
        subject: data.email.subject,
        emailQueueId: emailEntry.id,
      }),
    );
  }

  return {
    createdInAppNotifications: data.userIds.length,
    queuedEmail: Boolean(data.email),
  };
}

export async function processNotificationFlushJob(data: NotificationFlushJobData) {
  const pendingEmails = await prisma.emailQueue.findMany({
    where: {
      orgId: data.orgId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
    take: data.limit ?? 100,
  });

  if (!pendingEmails.length) {
    return {
      scanned: 0,
      sent: 0,
    };
  }

  const now = new Date();

  await prisma.$transaction(
    pendingEmails.map((email) =>
      prisma.emailQueue.update({
        where: {
          id: email.id,
        },
        data: {
          status: "SENT",
          sentAt: now,
          attempts: {
            increment: 1,
          },
        },
      }),
    ),
  );

  for (const email of pendingEmails) {
    console.log(
      JSON.stringify({
        level: "info",
        type: "email_flush_stub",
        orgId: email.orgId,
        to: email.toEmail,
        subject: email.subject,
        emailQueueId: email.id,
      }),
    );
  }

  return {
    scanned: pendingEmails.length,
    sent: pendingEmails.length,
  };
}
