import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/logger";
import { recordAuditLog } from "@/lib/audit";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        orgSlug: { label: "Organization", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password, orgSlug } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            memberships: {
              include: {
                organization: true,
              },
            },
          },
        });

        if (!user || !user.passwordHash) {
          logger.warn("Invalid login attempt: unknown user", { email });
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          logger.warn("Invalid login attempt: bad password", { email, userId: user.id });
          return null;
        }

        let membership = null;

        if (orgSlug) {
          membership = user.memberships.find((item) => item.organization.slug === orgSlug) ?? null;
        } else if (user.memberships.length === 1) {
          membership = user.memberships[0] ?? null;
        }

        if (!membership) {
          logger.warn("Login blocked: org not selected or not found", {
            userId: user.id,
            orgSlug,
            memberships: user.memberships.map((item) => item.organization.slug),
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await recordAuditLog({
          orgId: membership.orgId,
          actorUserId: user.id,
          action: "LOGIN",
          entityType: "Auth",
          entityId: user.id,
          metadata: {
            email: user.email,
            provider: "credentials",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          orgId: membership.orgId,
          orgSlug: membership.organization.slug,
          orgName: membership.organization.name,
          role: membership.role,
          membershipId: membership.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.orgId = (user as { orgId: string }).orgId;
        token.orgSlug = (user as { orgSlug: string }).orgSlug;
        token.orgName = (user as { orgName: string }).orgName;
        token.role = (user as { role: string }).role;
        token.membershipId = (user as { membershipId: string }).membershipId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
        session.user.orgId = String(token.orgId ?? "");
        session.user.orgSlug = String(token.orgSlug ?? "");
        session.user.orgName = String(token.orgName ?? "");
        session.user.role = String(token.role ?? "Requester") as "OrgAdmin" | "Agent" | "Requester" | "ReadOnly";
        session.user.membershipId = String(token.membershipId ?? "");
      }

      return session;
    },
  },
};
