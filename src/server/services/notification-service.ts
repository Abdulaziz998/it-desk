import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function createInAppNotifications(input: {
  orgId: string;
  userIds: string[];
  type: "ASSIGNMENT" | "MENTION" | "SLA_AT_RISK" | "SLA_BREACHED" | "ACCESS_REQUEST" | "INVITE" | "SYSTEM";
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (!uniqueUserIds.length) return;

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      orgId: input.orgId,
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      metadata: toJson(input.metadata),
    })),
  });
}

export async function queueEmail(input: {
  orgId: string;
  toEmail: string;
  subject: string;
  body: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.emailQueue.create({
    data: {
      orgId: input.orgId,
      toEmail: input.toEmail,
      subject: input.subject,
      body: input.body,
      createdById: input.createdById,
      metadata: toJson(input.metadata),
    },
  });

  // Email delivery is stubbed for MVP.
  console.log(
    JSON.stringify({
      level: "info",
      type: "email_stub",
      orgId: input.orgId,
      to: input.toEmail,
      subject: input.subject,
    }),
  );
}
