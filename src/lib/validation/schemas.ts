import { z } from "zod";

export const roles = ["OrgAdmin", "Agent", "Requester", "ReadOnly"] as const;
export const ticketStatuses = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"] as const;
export const ticketPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const accessRequestTypes = [
  "ADD_USER_TO_GROUP",
  "REMOVE_FROM_GROUP",
  "RESET_MFA",
  "GRANT_APP_ROLE",
] as const;
export const accessRequestStatuses = ["SUBMITTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "FAILED"] as const;
export const assetTypes = ["LAPTOP", "SERVER", "SAAS_APP", "LICENSE"] as const;
export const assetStatuses = ["IN_STOCK", "ASSIGNED", "RETIRED", "LOST"] as const;
export const autoAssignStrategies = ["ROUND_ROBIN", "TEAM_DEFAULT"] as const;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgSlug: z.string().min(2).max(64).optional(),
});

export const lookupOrgsSchema = z.object({
  email: z.string().email(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["Agent", "Requester", "ReadOnly"]),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const acceptInviteSchema = z.object({
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

export const ticketCreateSchema = z.object({
  title: z.string().min(4).max(160),
  description: z.string().min(10).max(10_000),
  priority: z.enum(ticketPriorities),
  categoryId: z.string().optional(),
  requesterId: z.string().optional(),
  assigneeId: z.string().optional(),
  teamId: z.string().optional(),
  dueAt: z.string().optional(),
  relatedAssetId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
});

export const ticketUpdateSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
  assigneeId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export const ticketCommentSchema = z.object({
  ticketId: z.string(),
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export const ticketBulkActionSchema = z.object({
  ticketIds: z.array(z.string()).min(1),
  action: z.enum(["ASSIGN", "SET_STATUS", "SET_PRIORITY"]),
  assigneeId: z.string().optional(),
  status: z.enum(ticketStatuses).optional(),
  priority: z.enum(ticketPriorities).optional(),
});

export const cannedResponseSchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(4).max(5000),
});

export const teamSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string()).default([]),
});

export const kbArticleSchema = z.object({
  title: z.string().min(4).max(160),
  slug: z.string().min(3).max(160),
  contentMarkdown: z.string().min(10),
  categoryId: z.string().optional(),
  isPublished: z.boolean().default(true),
});

export const kbFeedbackSchema = z.object({
  articleId: z.string(),
  helpful: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional(),
  keywords: z.string().max(500).optional(),
});

export const tagSchema = z.object({
  name: z.string().min(2).max(80),
  color: z.string().optional(),
});

export const slaRuleSchema = z.object({
  priority: z.enum(ticketPriorities),
  responseMinutes: z.coerce.number().int().min(1).max(7 * 24 * 60),
  resolutionMinutes: z.coerce.number().int().min(1).max(30 * 24 * 60),
});

export const orgProfileSchema = z.object({
  name: z.string().min(2).max(120),
  logoUrl: z.string().url().optional().or(z.literal("")),
  supportEmail: z.string().email().optional().or(z.literal("")),
  notificationEmail: z.string().email().optional().or(z.literal("")),
  brandPrimaryColor: z.string().max(20).optional(),
  brandSecondaryColor: z.string().max(20).optional(),
});

export const notificationPreferenceSchema = z.object({
  emailAssignments: z.boolean(),
  emailMentions: z.boolean(),
  emailSlaAlerts: z.boolean(),
  inAppEnabled: z.boolean(),
});

export const accessRequestSchema = z.object({
  requestType: z.enum(accessRequestTypes),
  title: z.string().min(4).max(160),
  description: z.string().min(10).max(5000),
  targetUpn: z.string().email().optional(),
  targetGroupId: z.string().min(2).max(200).optional(),
  appRoleName: z.string().min(2).max(200).optional(),
  assignedToId: z.string().optional(),
  relatedTicketId: z.string().optional(),
});

export const accessRequestStatusSchema = z.object({
  accessRequestId: z.string(),
  status: z.enum(accessRequestStatuses),
});

export const entraIntegrationSchema = z
  .object({
    enabled: z.boolean(),
    tenantId: z.string().max(200),
    clientId: z.string().max(200),
    clientSecret: z.string().max(500),
  })
  .superRefine((value, context) => {
    if (!value.enabled) return;

    if (!value.tenantId.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["tenantId"], message: "Tenant ID is required when enabled" });
    }
    if (!value.clientId.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clientId"], message: "Client ID is required when enabled" });
    }
    if (!value.clientSecret.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clientSecret"], message: "Client secret is required when enabled" });
    }
  });

export const integrationLogFilterSchema = z.object({
  provider: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const assetSchema = z.object({
  assetTag: z.string().min(2).max(80),
  type: z.enum(assetTypes),
  name: z.string().min(2).max(120),
  assignedToId: z.string().optional(),
  status: z.enum(assetStatuses),
  purchaseDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const autoAssignRuleSchema = z.object({
  name: z.string().min(2).max(120),
  categoryId: z.string().optional(),
  teamId: z.string().optional(),
  assignmentStrategy: z.enum(autoAssignStrategies),
  isActive: z.boolean().default(true),
});

export const profileSchema = z.object({
  name: z.string().min(2).max(120),
});

export const passwordResetStubSchema = z.object({
  email: z.string().email(),
});
