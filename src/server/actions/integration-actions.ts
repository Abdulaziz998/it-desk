"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/context";
import { entraIntegrationSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

const testConnectionSchema = z.object({
  tenantId: z.string().optional(),
});

export async function upsertEntraIntegration(input: unknown) {
  return runSafeAction("upsertEntraIntegration", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = entraIntegrationSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid integration settings payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await prisma.entraIntegration.findUnique({
      where: {
        orgId_provider: {
          orgId: context.orgId,
          provider: "entra",
        },
      },
      select: {
        id: true,
        clientSecret: true,
      },
    });

    const integration = await prisma.entraIntegration.upsert({
      where: {
        orgId_provider: {
          orgId: context.orgId,
          provider: "entra",
        },
      },
      create: {
        orgId: context.orgId,
        provider: "entra",
        enabled: parsed.data.enabled,
        tenantId: parsed.data.tenantId,
        clientId: parsed.data.clientId,
        clientSecret: parsed.data.clientSecret,
      },
      update: {
        enabled: parsed.data.enabled,
        tenantId: parsed.data.tenantId,
        clientId: parsed.data.clientId,
        clientSecret: parsed.data.clientSecret || existing?.clientSecret || "",
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ENTRA_INTEGRATION_UPDATED",
      entityType: "EntraIntegration",
      entityId: integration.id,
      metadata: {
        enabled: integration.enabled,
        tenantId: integration.tenantId,
        clientId: integration.clientId,
      },
    });

    return integration;
  });
}

export async function testEntraConnection(input: unknown) {
  return runSafeAction("testEntraConnection", async () => {
    const context = await requirePermission("settings.manage");
    const parsed = testConnectionSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid test connection payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const integration = await prisma.entraIntegration.findUnique({
      where: {
        orgId_provider: {
          orgId: context.orgId,
          provider: "entra",
        },
      },
    });

    if (!integration || !integration.enabled || !integration.tenantId || !integration.clientId || !integration.clientSecret) {
      throw new AppError("Entra integration is not configured", "INTEGRATION_NOT_CONFIGURED", 400);
    }

    const message = `Mock Entra connection successful for tenant ${integration.tenantId}`;

    const log = await prisma.integrationActionLog.create({
      data: {
        orgId: context.orgId,
        provider: "entra",
        action: "testConnection",
        status: "SUCCESS",
        message,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "ENTRA_CONNECTION_TESTED",
      entityType: "IntegrationActionLog",
      entityId: log.id,
      metadata: {
        provider: "entra",
        tenantId: integration.tenantId,
      },
    });

    return { ok: true, message };
  });
}
