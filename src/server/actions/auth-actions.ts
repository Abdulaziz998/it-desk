"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import {
  acceptInviteSchema,
  inviteUserSchema,
  lookupOrgsSchema,
  passwordResetStubSchema,
  profileSchema,
} from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

export async function lookupOrganizationsForLogin(email: string) {
  return runSafeAction("lookupOrganizationsForLogin", async () => {
    const parsed = lookupOrgsSchema.safeParse({ email });
    if (!parsed.success) {
      throw new AppError("Enter a valid email", "VALIDATION_ERROR", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    const organizations =
      user?.memberships.map((membership) => ({
        slug: membership.organization.slug,
        name: membership.organization.name,
      })) ?? [];

    return { organizations };
  });
}

export async function createInvitation(input: unknown) {
  return runSafeAction("createInvitation", async () => {
    const context = await requirePermission("users.manage");
    const parsed = inviteUserSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid invitation payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        orgId: context.orgId,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        token,
        expiresAt,
        invitedById: context.userId,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const inviteLink = `${baseUrl}/invite/${token}`;

    await prisma.emailQueue.create({
      data: {
        orgId: context.orgId,
        toEmail: parsed.data.email.toLowerCase(),
        subject: `Invitation to ${context.orgName} on IT OpsDesk`,
        body: `Use this invitation link to join: ${inviteLink}`,
        createdById: context.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "INVITE_CREATED",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
    });

    return {
      inviteLink,
      invitationId: invitation.id,
      expiresAt: invitation.expiresAt,
    };
  });
}

export async function acceptInvitation(token: string, input: unknown) {
  return runSafeAction("acceptInvitation", async () => {
    const parsed = acceptInviteSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid invite form data", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new AppError("Invitation not found", "NOT_FOUND", 404);
    }

    if (invitation.acceptedAt) {
      throw new AppError("Invitation is already used", "INVITE_USED", 409);
    }

    if (invitation.expiresAt < new Date()) {
      throw new AppError("Invitation has expired", "INVITE_EXPIRED", 410);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.user.upsert({
      where: { email: invitation.email.toLowerCase() },
      create: {
        email: invitation.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash,
      },
      update: {
        name: parsed.data.name,
        passwordHash,
      },
    });

    const membership = await prisma.organizationMember.upsert({
      where: {
        orgId_userId: {
          orgId: invitation.orgId,
          userId: user.id,
        },
      },
      create: {
        orgId: invitation.orgId,
        userId: user.id,
        role: invitation.role,
      },
      update: {
        role: invitation.role,
      },
    });

    await prisma.notificationPreference.upsert({
      where: {
        orgId_userId: {
          orgId: invitation.orgId,
          userId: user.id,
        },
      },
      create: {
        orgId: invitation.orgId,
        userId: user.id,
      },
      update: {},
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await recordAuditLog({
      orgId: invitation.orgId,
      actorUserId: user.id,
      action: "INVITE_ACCEPTED",
      entityType: "Invitation",
      entityId: invitation.id,
      metadata: {
        membershipId: membership.id,
      },
    });

    return {
      orgName: invitation.organization.name,
      orgSlug: invitation.organization.slug,
      email: user.email,
    };
  });
}

export async function sendPasswordResetStub(input: unknown) {
  return runSafeAction("sendPasswordResetStub", async () => {
    const parsed = passwordResetStubSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid email", "VALIDATION_ERROR", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: { memberships: true },
    });

    if (!user) {
      return { queued: 0 };
    }

    await Promise.all(
      user.memberships.map((membership) =>
        prisma.emailQueue.create({
          data: {
            orgId: membership.orgId,
            toEmail: user.email,
            subject: "Password reset (stub)",
            body: "Password reset is stubbed in MVP. Contact your OrgAdmin.",
          },
        }),
      ),
    );

    return { queued: user.memberships.length };
  });
}

export async function updateProfile(input: unknown) {
  return runSafeAction("updateProfile", async () => {
    const context = await requireAuthContext();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid profile data", "VALIDATION_ERROR", 400);
    }

    await prisma.user.update({
      where: { id: context.userId },
      data: {
        name: parsed.data.name,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "PROFILE_UPDATED",
      entityType: "User",
      entityId: context.userId,
      metadata: {
        name: parsed.data.name,
      },
    });

    return { success: true };
  });
}
