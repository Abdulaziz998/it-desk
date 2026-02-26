import { type NotificationType } from "@prisma/client";

export type SlaScanJobData = {
  orgId?: string;
  triggeredById?: string;
};

export type WorkflowJobData = {
  triggeredById?: string;
};

export type NotificationDispatchJobData = {
  orgId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  email?: {
    toEmail: string;
    subject: string;
    body: string;
    createdById?: string;
    metadata?: Record<string, unknown>;
  };
};

export type NotificationFlushJobData = {
  orgId?: string;
  limit?: number;
};

export type JobType = "sla.scan" | "workflows.run" | "notifications.dispatch" | "notifications.flush";
