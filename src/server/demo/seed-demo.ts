import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { type Role, type TicketPriority } from "@prisma/client";
import { permissionCatalog } from "@/lib/auth/permissions";

const DEMO_PASSWORD = "DemoPass123!";

type SeedCounts = {
  permissions: number;
  rolePermissions: number;
  organizations: number;
  users: number;
  memberships: number;
  categories: number;
  teams: number;
  tickets: number;
  accessRequests: number;
  notifications: number;
  auditLogs: number;
};

const rolePermissionMatrix: Record<Role, string[]> = {
  OrgAdmin: permissionCatalog.map((permission) => permission.key),
  Agent: [
    "ticket.read",
    "ticket.write",
    "ticket.assign",
    "kb.read",
    "kb.write",
    "assets.read",
    "assets.write",
    "accessRequests.approve",
    "accessRequests.execute",
    "metrics.read",
  ],
  Requester: ["ticket.read", "ticket.write", "kb.read", "assets.read", "accessRequests.execute"],
  ReadOnly: ["ticket.read", "kb.read", "assets.read", "auditLogs.read", "metrics.read"],
};

async function ensurePermission(input: { key: string; description: string }) {
  const existing = await prisma.permission.findUnique({
    where: { key: input.key },
    select: { id: true },
  });

  if (existing) {
    await prisma.permission.update({
      where: { key: input.key },
      data: { description: input.description },
    });
    return { id: existing.id, created: false };
  }

  const created = await prisma.permission.create({ data: input });
  return { id: created.id, created: true };
}

async function ensureUser(email: string, name: string, passwordHash: string) {
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, passwordHash: true },
  });

  if (existing) {
    if (!existing.passwordHash) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    }

    return { id: existing.id, created: false };
  }

  const created = await prisma.user.create({
    data: {
      email: normalized,
      name,
      passwordHash,
    },
  });

  return { id: created.id, created: true };
}

async function ensureOrganization(slug: string, name: string, logoUrl: string) {
  const existing = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    await prisma.organization.update({
      where: { slug },
      data: {
        name,
        logoUrl,
      },
    });

    return { id: existing.id, created: false };
  }

  const created = await prisma.organization.create({
    data: {
      slug,
      name,
      logoUrl,
    },
  });

  return { id: created.id, created: true };
}

async function ensureMembership(input: { orgId: string; userId: string; role: Role; title?: string; isManager?: boolean; agentCapacity?: number }) {
  const existing = await prisma.organizationMember.findUnique({
    where: {
      orgId_userId: {
        orgId: input.orgId,
        userId: input.userId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.organizationMember.update({
      where: { id: existing.id },
      data: {
        role: input.role,
        title: input.title,
        isManager: input.isManager ?? false,
        agentCapacity: input.agentCapacity ?? 20,
      },
    });
    return { id: existing.id, created: false };
  }

  const created = await prisma.organizationMember.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      role: input.role,
      title: input.title,
      isManager: input.isManager ?? false,
      agentCapacity: input.agentCapacity ?? 20,
    },
  });

  return { id: created.id, created: true };
}

async function ensureCategory(input: { orgId: string; name: string; keywords: string }) {
  const existing = await prisma.category.findUnique({
    where: { orgId_name: { orgId: input.orgId, name: input.name } },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.category.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      keywords: input.keywords,
    },
  });

  return { id: created.id, created: true };
}

async function ensureTeam(input: { orgId: string; name: string; description: string }) {
  const existing = await prisma.team.findUnique({
    where: { orgId_name: { orgId: input.orgId, name: input.name } },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.team.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      description: input.description,
    },
  });

  return { id: created.id, created: true };
}

async function ensureSlaRules(orgId: string) {
  const priorities: Array<{ priority: TicketPriority; responseMinutes: number; resolutionMinutes: number }> = [
    { priority: "LOW", responseMinutes: 240, resolutionMinutes: 2880 },
    { priority: "MEDIUM", responseMinutes: 120, resolutionMinutes: 1440 },
    { priority: "HIGH", responseMinutes: 60, resolutionMinutes: 480 },
    { priority: "CRITICAL", responseMinutes: 30, resolutionMinutes: 240 },
  ];

  for (const rule of priorities) {
    await prisma.slaRule.upsert({
      where: {
        orgId_priority: {
          orgId,
          priority: rule.priority,
        },
      },
      create: {
        orgId,
        priority: rule.priority,
        responseMinutes: rule.responseMinutes,
        resolutionMinutes: rule.resolutionMinutes,
      },
      update: {
        responseMinutes: rule.responseMinutes,
        resolutionMinutes: rule.resolutionMinutes,
      },
    });
  }
}

async function ensureTicket(input: {
  orgId: string;
  orgSlug: string;
  number: number;
  title: string;
  description: string;
  priority: TicketPriority;
  requesterId: string;
  assigneeId: string;
  categoryId: string;
  teamId: string;
}) {
  const existing = await prisma.ticket.findUnique({
    where: {
      orgId_number: {
        orgId: input.orgId,
        number: input.number,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.ticket.create({
    data: {
      orgId: input.orgId,
      number: input.number,
      key: `${input.orgSlug.toUpperCase()}-${input.number}`,
      title: input.title,
      description: input.description,
      status: "OPEN",
      priority: input.priority,
      requesterId: input.requesterId,
      assigneeId: input.assigneeId,
      categoryId: input.categoryId,
      teamId: input.teamId,
      dueAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    },
  });

  await prisma.ticketWatcher.createMany({
    data: [input.requesterId, input.assigneeId].map((userId) => ({
      orgId: input.orgId,
      ticketId: created.id,
      userId,
    })),
    skipDuplicates: true,
  });

  return { id: created.id, created: true };
}

async function ensureAccessRequest(input: {
  orgId: string;
  requesterId: string;
  assignedToId: string;
  relatedTicketId: string;
}) {
  const existing = await prisma.accessRequest.findFirst({
    where: {
      orgId: input.orgId,
      title: "Demo: Reset MFA",
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.accessRequest.create({
    data: {
      orgId: input.orgId,
      requestType: "RESET_MFA",
      status: "SUBMITTED",
      title: "Demo: Reset MFA",
      description: "Demo access request for seeded production environment.",
      targetUpn: "acme.requester@demo.local",
      requesterId: input.requesterId,
      assignedToId: input.assignedToId,
      relatedTicketId: input.relatedTicketId,
    },
  });

  return { id: created.id, created: true };
}

async function ensureNotification(input: {
  orgId: string;
  userId: string;
  type: "ASSIGNMENT" | "MENTION" | "SLA_AT_RISK" | "SLA_BREACHED" | "ACCESS_REQUEST" | "INVITE" | "SYSTEM";
  title: string;
  message: string;
  link?: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });

  return { id: created.id, created: true };
}

export async function seedDemoData() {
  const counts: SeedCounts = {
    permissions: 0,
    rolePermissions: 0,
    organizations: 0,
    users: 0,
    memberships: 0,
    categories: 0,
    teams: 0,
    tickets: 0,
    accessRequests: 0,
    notifications: 0,
    auditLogs: 0,
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const permissions = await Promise.all(permissionCatalog.map((permission) => ensurePermission(permission)));
  counts.permissions = permissions.filter((item) => item.created).length;

  const permissionIdByKey = Object.fromEntries(
    permissions.map((permission, index) => [permissionCatalog[index].key, permission.id]),
  );

  const rolePermissionRows = (Object.entries(rolePermissionMatrix) as Array<[Role, string[]]>).flatMap(([role, keys]) =>
    keys.map((key) => ({ role, permissionId: permissionIdByKey[key] })),
  );
  const rolePermissionCreate = await prisma.rolePermission.createMany({
    data: rolePermissionRows,
    skipDuplicates: true,
  });
  counts.rolePermissions = rolePermissionCreate.count;

  const users = await Promise.all([
    ensureUser("acme.admin@demo.local", "Acme Org Admin", passwordHash),
    ensureUser("acme.agent@demo.local", "Acme Agent", passwordHash),
    ensureUser("acme.requester@demo.local", "Acme Requester", passwordHash),
    ensureUser("globex.admin@demo.local", "Globex Org Admin", passwordHash),
    ensureUser("globex.agent@demo.local", "Globex Agent", passwordHash),
    ensureUser("globex.requester@demo.local", "Globex Requester", passwordHash),
  ]);
  counts.users = users.filter((item) => item.created).length;

  const userByEmail = {
    acmeAdmin: users[0]?.id,
    acmeAgent: users[1]?.id,
    acmeRequester: users[2]?.id,
    globexAdmin: users[3]?.id,
    globexAgent: users[4]?.id,
    globexRequester: users[5]?.id,
  };

  const acme = await ensureOrganization("acme", "Acme Industries", "https://example.com/logos/acme.png");
  const globex = await ensureOrganization("globex", "Globex Corporation", "https://example.com/logos/globex.png");
  counts.organizations = [acme, globex].filter((item) => item.created).length;

  await prisma.organizationSetting.upsert({
    where: { orgId: acme.id },
    create: {
      orgId: acme.id,
      supportEmail: "support@acme.demo.local",
      notificationEmail: "notifications@acme.demo.local",
      timezone: "UTC",
    },
    update: {
      supportEmail: "support@acme.demo.local",
      notificationEmail: "notifications@acme.demo.local",
    },
  });

  await prisma.organizationSetting.upsert({
    where: { orgId: globex.id },
    create: {
      orgId: globex.id,
      supportEmail: "support@globex.demo.local",
      notificationEmail: "notifications@globex.demo.local",
      timezone: "UTC",
    },
    update: {
      supportEmail: "support@globex.demo.local",
      notificationEmail: "notifications@globex.demo.local",
    },
  });

  const memberships = await Promise.all([
    ensureMembership({ orgId: acme.id, userId: userByEmail.acmeAdmin!, role: "OrgAdmin", title: "IT Admin", isManager: true }),
    ensureMembership({ orgId: acme.id, userId: userByEmail.acmeAgent!, role: "Agent", title: "Support Engineer", agentCapacity: 25 }),
    ensureMembership({ orgId: acme.id, userId: userByEmail.acmeRequester!, role: "Requester" }),
    ensureMembership({ orgId: globex.id, userId: userByEmail.globexAdmin!, role: "OrgAdmin", title: "IT Director", isManager: true }),
    ensureMembership({ orgId: globex.id, userId: userByEmail.globexAgent!, role: "Agent", title: "Ops Agent", agentCapacity: 20 }),
    ensureMembership({ orgId: globex.id, userId: userByEmail.globexRequester!, role: "Requester" }),
  ]);
  counts.memberships = memberships.filter((item) => item.created).length;

  await ensureSlaRules(acme.id);
  await ensureSlaRules(globex.id);

  const acmeCategory = await ensureCategory({ orgId: acme.id, name: "Access", keywords: "mfa,group,role" });
  const globexCategory = await ensureCategory({ orgId: globex.id, name: "Apps", keywords: "license,app,permission" });
  counts.categories = [acmeCategory, globexCategory].filter((item) => item.created).length;

  const acmeTeam = await ensureTeam({ orgId: acme.id, name: "Service Desk", description: "Primary support team" });
  const globexTeam = await ensureTeam({ orgId: globex.id, name: "IAM Ops", description: "Identity operations" });
  counts.teams = [acmeTeam, globexTeam].filter((item) => item.created).length;

  const acmeTicket = await ensureTicket({
    orgId: acme.id,
    orgSlug: "acme",
    number: 1,
    title: "Demo: VPN access issue",
    description: "Cannot connect to VPN from home network.",
    priority: "HIGH",
    requesterId: userByEmail.acmeRequester!,
    assigneeId: userByEmail.acmeAgent!,
    categoryId: acmeCategory.id,
    teamId: acmeTeam.id,
  });

  const globexTicket = await ensureTicket({
    orgId: globex.id,
    orgSlug: "globex",
    number: 1,
    title: "Demo: App role request",
    description: "Need access to reporting app role.",
    priority: "MEDIUM",
    requesterId: userByEmail.globexRequester!,
    assigneeId: userByEmail.globexAgent!,
    categoryId: globexCategory.id,
    teamId: globexTeam.id,
  });

  counts.tickets = [acmeTicket, globexTicket].filter((item) => item.created).length;

  const [acmeOrg, globexOrg] = await Promise.all([
    prisma.organization.findUnique({ where: { id: acme.id }, select: { nextTicketNumber: true } }),
    prisma.organization.findUnique({ where: { id: globex.id }, select: { nextTicketNumber: true } }),
  ]);

  if ((acmeOrg?.nextTicketNumber ?? 0) < 2) {
    await prisma.organization.update({
      where: { id: acme.id },
      data: { nextTicketNumber: 2 },
    });
  }

  if ((globexOrg?.nextTicketNumber ?? 0) < 2) {
    await prisma.organization.update({
      where: { id: globex.id },
      data: { nextTicketNumber: 2 },
    });
  }

  const accessRequest = await ensureAccessRequest({
    orgId: acme.id,
    requesterId: userByEmail.acmeRequester!,
    assignedToId: userByEmail.acmeAgent!,
    relatedTicketId: acmeTicket.id,
  });
  counts.accessRequests = accessRequest.created ? 1 : 0;

  const notifications = await Promise.all([
    ensureNotification({
      orgId: acme.id,
      userId: userByEmail.acmeAgent!,
      type: "ASSIGNMENT",
      title: "Assigned ticket ACME-1",
      message: "Demo seeded ticket",
      link: `/tickets/${acmeTicket.id}`,
    }),
    ensureNotification({
      orgId: globex.id,
      userId: userByEmail.globexAgent!,
      type: "ASSIGNMENT",
      title: "Assigned ticket GLOBEX-1",
      message: "Demo seeded ticket",
      link: `/tickets/${globexTicket.id}`,
    }),
  ]);
  counts.notifications = notifications.filter((item) => item.created).length;

  await prisma.auditLog.createMany({
    data: [
      {
        orgId: acme.id,
        actorUserId: userByEmail.acmeAdmin,
        action: "DEMO_SEEDED",
        entityType: "System",
        metadata: { counts },
      },
      {
        orgId: globex.id,
        actorUserId: userByEmail.globexAdmin,
        action: "DEMO_SEEDED",
        entityType: "System",
        metadata: { counts },
      },
    ],
  });
  counts.auditLogs = 2;

  return {
    counts,
    demoPassword: DEMO_PASSWORD,
  };
}
