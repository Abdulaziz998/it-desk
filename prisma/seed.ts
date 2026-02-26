import bcrypt from "bcryptjs";
import { PrismaClient, type Role, type TicketPriority, type TicketStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoPassword = await bcrypt.hash("DemoPass123!", 10);

  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.integrationActionLog.deleteMany();
  await prisma.entraIntegration.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const permissionCatalog = [
    { key: "ticket.read", description: "Read tickets" },
    { key: "ticket.write", description: "Create and update tickets" },
    { key: "ticket.assign", description: "Assign tickets" },
    { key: "kb.read", description: "Read knowledge articles" },
    { key: "kb.write", description: "Create and edit knowledge articles" },
    { key: "assets.read", description: "Read assets" },
    { key: "assets.write", description: "Create and update assets" },
    { key: "accessRequests.approve", description: "Approve access requests" },
    { key: "accessRequests.execute", description: "Create and execute access requests" },
    { key: "settings.manage", description: "Manage organization settings" },
    { key: "users.manage", description: "Manage users and teams" },
    { key: "auditLogs.read", description: "Read audit logs" },
    { key: "metrics.read", description: "Read metrics and dashboards" },
  ] as const;

  const createdPermissions = await Promise.all(
    permissionCatalog.map((permission) =>
      prisma.permission.create({
        data: permission,
      }),
    ),
  );

  const permissionIdByKey = Object.fromEntries(createdPermissions.map((permission) => [permission.key, permission.id]));

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

  await prisma.rolePermission.createMany({
    data: (Object.entries(rolePermissionMatrix) as Array<[Role, string[]]>).flatMap(([role, permissionKeys]) =>
      permissionKeys.map((permissionKey) => ({
        role,
        permissionId: permissionIdByKey[permissionKey],
      })),
    ),
    skipDuplicates: true,
  });

  const users = await Promise.all(
    [
      ["acme.admin@demo.local", "Acme Org Admin"],
      ["acme.agent@demo.local", "Acme Agent One"],
      ["acme.requester@demo.local", "Acme Requester"],
      ["acme.readonly@demo.local", "Acme Auditor"],
      ["globex.admin@demo.local", "Globex Org Admin"],
      ["globex.agent@demo.local", "Globex Agent"],
      ["globex.requester@demo.local", "Globex Requester"],
      ["shared.agent@demo.local", "Shared Agent"],
      ["manager@demo.local", "Manager User"],
    ].map(([email, name]) =>
      prisma.user.create({
        data: {
          email,
          name,
          passwordHash: demoPassword,
        },
      }),
    ),
  );

  const userByEmail = Object.fromEntries(users.map((user) => [user.email, user]));

  const acme = await prisma.organization.create({
    data: {
      slug: "acme",
      name: "Acme Industries",
      logoUrl: "https://example.com/logos/acme.png",
    },
  });

  const globex = await prisma.organization.create({
    data: {
      slug: "globex",
      name: "Globex Corporation",
      logoUrl: "https://example.com/logos/globex.png",
    },
  });

  await prisma.entraIntegration.create({
    data: {
      orgId: acme.id,
      provider: "entra",
      enabled: true,
      tenantId: "acme-tenant-001",
      clientId: "acme-client-001",
      clientSecret: "acme-secret-001",
    },
  });

  await prisma.organizationSetting.createMany({
    data: [
      {
        orgId: acme.id,
        supportEmail: "support@acme.demo.local",
        notificationEmail: "notifications@acme.demo.local",
        timezone: "America/New_York",
        brandPrimaryColor: "#0f172a",
        brandSecondaryColor: "#0284c7",
      },
      {
        orgId: globex.id,
        supportEmail: "support@globex.demo.local",
        notificationEmail: "notifications@globex.demo.local",
        timezone: "America/Chicago",
        brandPrimaryColor: "#1f2937",
        brandSecondaryColor: "#0ea5e9",
      },
    ],
  });

  const acmeMemberships = await Promise.all([
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["acme.admin@demo.local"].id,
        role: "OrgAdmin",
        title: "Head of IT",
        isManager: true,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["acme.agent@demo.local"].id,
        role: "Agent",
        title: "IT Support Engineer",
        agentCapacity: 28,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["shared.agent@demo.local"].id,
        role: "Agent",
        title: "Tier 2 Specialist",
        agentCapacity: 22,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["acme.requester@demo.local"].id,
        role: "Requester",
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["acme.readonly@demo.local"].id,
        role: "ReadOnly",
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: acme.id,
        userId: userByEmail["manager@demo.local"].id,
        role: "Requester",
        isManager: true,
      },
    }),
  ]);

  const globexMemberships = await Promise.all([
    prisma.organizationMember.create({
      data: {
        orgId: globex.id,
        userId: userByEmail["globex.admin@demo.local"].id,
        role: "OrgAdmin",
        title: "IT Director",
        isManager: true,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: globex.id,
        userId: userByEmail["globex.agent@demo.local"].id,
        role: "Agent",
        title: "Ops Agent",
        agentCapacity: 25,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: globex.id,
        userId: userByEmail["shared.agent@demo.local"].id,
        role: "Agent",
        title: "Shared Specialist",
        agentCapacity: 20,
      },
    }),
    prisma.organizationMember.create({
      data: {
        orgId: globex.id,
        userId: userByEmail["globex.requester@demo.local"].id,
        role: "Requester",
      },
    }),
  ]);

  await prisma.notificationPreference.createMany({
    data: [...acmeMemberships, ...globexMemberships].map((membership) => ({
      orgId: membership.orgId,
      userId: membership.userId,
      emailAssignments: true,
      emailMentions: true,
      emailSlaAlerts: true,
      inAppEnabled: true,
    })),
  });

  await prisma.slaRule.createMany({
    data: [
      ...[
        { priority: "LOW", responseMinutes: 240, resolutionMinutes: 2880 },
        { priority: "MEDIUM", responseMinutes: 120, resolutionMinutes: 1440 },
        { priority: "HIGH", responseMinutes: 60, resolutionMinutes: 480 },
        { priority: "CRITICAL", responseMinutes: 30, resolutionMinutes: 240 },
      ].map(({ priority, responseMinutes, resolutionMinutes }) => ({
        orgId: acme.id,
        priority: priority as TicketPriority,
        responseMinutes,
        resolutionMinutes,
      })),
      ...[
        { priority: "LOW", responseMinutes: 180, resolutionMinutes: 2160 },
        { priority: "MEDIUM", responseMinutes: 90, resolutionMinutes: 720 },
        { priority: "HIGH", responseMinutes: 45, resolutionMinutes: 360 },
        { priority: "CRITICAL", responseMinutes: 20, resolutionMinutes: 120 },
      ].map(({ priority, responseMinutes, resolutionMinutes }) => ({
        orgId: globex.id,
        priority: priority as TicketPriority,
        responseMinutes,
        resolutionMinutes,
      })),
    ],
  });

  const [acmeNetwork, acmeHardware, acmeAccess] = await Promise.all([
    prisma.category.create({ data: { orgId: acme.id, name: "Network", keywords: "vpn,wifi,latency,packet" } }),
    prisma.category.create({ data: { orgId: acme.id, name: "Hardware", keywords: "laptop,monitor,keyboard,battery" } }),
    prisma.category.create({ data: { orgId: acme.id, name: "Access", keywords: "role,group,permission,mfa" } }),
  ]);

  const [globexApps, , globexIdentity] = await Promise.all([
    prisma.category.create({ data: { orgId: globex.id, name: "Apps", keywords: "crm,erp,finance" } }),
    prisma.category.create({ data: { orgId: globex.id, name: "Infrastructure", keywords: "server,monitoring,disk" } }),
    prisma.category.create({ data: { orgId: globex.id, name: "Identity", keywords: "mfa,group,access" } }),
  ]);

  const acmeTags = await Promise.all([
    prisma.tag.create({ data: { orgId: acme.id, name: "vip", color: "#ef4444" } }),
    prisma.tag.create({ data: { orgId: acme.id, name: "oncall", color: "#0ea5e9" } }),
    prisma.tag.create({ data: { orgId: acme.id, name: "security", color: "#f59e0b" } }),
  ]);

  const globexTags = await Promise.all([
    prisma.tag.create({ data: { orgId: globex.id, name: "prod", color: "#ef4444" } }),
    prisma.tag.create({ data: { orgId: globex.id, name: "compliance", color: "#f59e0b" } }),
  ]);

  const acmeTeam = await prisma.team.create({
    data: {
      orgId: acme.id,
      name: "Service Desk",
      description: "Primary service desk team",
    },
  });

  const globexTeam = await prisma.team.create({
    data: {
      orgId: globex.id,
      name: "IAM Operations",
      description: "Identity operations",
    },
  });

  const acmeAgentMembership = acmeMemberships.find((member) => member.userId === userByEmail["acme.agent@demo.local"].id)!;
  const acmeSharedMembership = acmeMemberships.find((member) => member.userId === userByEmail["shared.agent@demo.local"].id)!;
  const globexAgentMembership = globexMemberships.find((member) => member.userId === userByEmail["globex.agent@demo.local"].id)!;
  const globexSharedMembership = globexMemberships.find((member) => member.userId === userByEmail["shared.agent@demo.local"].id)!;

  await prisma.teamMember.createMany({
    data: [
      { orgId: acme.id, teamId: acmeTeam.id, memberId: acmeAgentMembership.id },
      { orgId: acme.id, teamId: acmeTeam.id, memberId: acmeSharedMembership.id },
      { orgId: globex.id, teamId: globexTeam.id, memberId: globexAgentMembership.id },
      { orgId: globex.id, teamId: globexTeam.id, memberId: globexSharedMembership.id },
    ],
  });

  await prisma.autoAssignRule.createMany({
    data: [
      {
        orgId: acme.id,
        name: "Hardware to Service Desk",
        categoryId: acmeHardware.id,
        teamId: acmeTeam.id,
        assignmentStrategy: "ROUND_ROBIN",
        isActive: true,
      },
      {
        orgId: globex.id,
        name: "Identity to IAM Ops",
        categoryId: globexIdentity.id,
        teamId: globexTeam.id,
        assignmentStrategy: "ROUND_ROBIN",
        isActive: true,
      },
    ],
  });

  const [acmeLaptop, acmeServer, globexLicense] = await Promise.all([
    prisma.asset.create({
      data: {
        orgId: acme.id,
        assetTag: "ACME-LAP-1001",
        type: "LAPTOP",
        name: "MacBook Pro 14",
        assignedToId: userByEmail["acme.requester@demo.local"].id,
        status: "ASSIGNED",
        purchaseDate: new Date("2025-11-01T00:00:00Z"),
      },
    }),
    prisma.asset.create({
      data: {
        orgId: acme.id,
        assetTag: "ACME-SRV-09",
        type: "SERVER",
        name: "File Server 09",
        status: "IN_STOCK",
      },
    }),
    prisma.asset.create({
      data: {
        orgId: globex.id,
        assetTag: "GLOBEX-LIC-22",
        type: "LICENSE",
        name: "CRM Enterprise License",
        status: "ASSIGNED",
        assignedToId: userByEmail["globex.requester@demo.local"].id,
      },
    }),
  ]);

  await prisma.cannedResponse.createMany({
    data: [
      {
        orgId: acme.id,
        title: "Password reset acknowledgement",
        content: "Hi, we have initiated your password reset workflow. Please confirm once completed.",
        createdById: userByEmail["acme.agent@demo.local"].id,
      },
      {
        orgId: acme.id,
        title: "Investigating network issue",
        content: "We are currently collecting network diagnostics. Next update in 30 minutes.",
        createdById: userByEmail["acme.agent@demo.local"].id,
      },
      {
        orgId: globex.id,
        title: "Access request approved",
        content: "Your access request has been approved and is now in provisioning.",
        createdById: userByEmail["globex.agent@demo.local"].id,
      },
    ],
  });

  const acmeKb = await Promise.all([
    prisma.knowledgeArticle.create({
      data: {
        orgId: acme.id,
        title: "Fixing common VPN drops",
        slug: "fix-vpn-drops",
        contentMarkdown: "# VPN drops\n\n1. Restart VPN client\n2. Flush DNS\n3. Reconnect",
        categoryId: acmeNetwork.id,
        isPublished: true,
        authorId: userByEmail["acme.agent@demo.local"].id,
      },
    }),
    prisma.knowledgeArticle.create({
      data: {
        orgId: acme.id,
        title: "Laptop battery diagnostics",
        slug: "laptop-battery-diagnostics",
        contentMarkdown: "# Battery diagnostics\n\nCollect battery report and share with IT.",
        categoryId: acmeHardware.id,
        isPublished: true,
        authorId: userByEmail["acme.agent@demo.local"].id,
      },
    }),
  ]);

  const globexKb = await Promise.all([
    prisma.knowledgeArticle.create({
      data: {
        orgId: globex.id,
        title: "Grant app role checklist",
        slug: "grant-app-role-checklist",
        contentMarkdown: "# App role grant checklist\n\nValidate manager approval and SoD checks.",
        categoryId: globexIdentity.id,
        isPublished: true,
        authorId: userByEmail["globex.agent@demo.local"].id,
      },
    }),
  ]);

  async function createTicketForOrg(input: {
    orgId: string;
    orgSlug: string;
    number: number;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    requesterId: string;
    assigneeId?: string;
    teamId?: string;
    categoryId?: string;
    relatedAssetId?: string;
    dueAt?: Date;
    createdAt: Date;
    tags?: string[];
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        orgId: input.orgId,
        number: input.number,
        key: `${input.orgSlug.toUpperCase()}-${input.number}`,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        requesterId: input.requesterId,
        assigneeId: input.assigneeId,
        teamId: input.teamId,
        categoryId: input.categoryId,
        relatedAssetId: input.relatedAssetId,
        dueAt: input.dueAt,
        atRisk: input.dueAt ? input.dueAt.getTime() - Date.now() < 4 * 60 * 60 * 1000 && input.dueAt.getTime() > Date.now() : false,
        breachedAt: input.dueAt && input.dueAt.getTime() < Date.now() ? new Date() : null,
        resolvedAt: input.status === "RESOLVED" || input.status === "CLOSED" ? new Date(input.createdAt.getTime() + 6 * 60 * 60 * 1000) : null,
        closedAt: input.status === "CLOSED" ? new Date(input.createdAt.getTime() + 7 * 60 * 60 * 1000) : null,
        createdAt: input.createdAt,
      },
    });

    await prisma.ticketWatcher.createMany({
      data: [input.requesterId, input.assigneeId].filter(Boolean).map((userId) => ({
        orgId: input.orgId,
        ticketId: ticket.id,
        userId: userId as string,
      })),
      skipDuplicates: true,
    });

    if (input.tags?.length) {
      await prisma.ticketTag.createMany({
        data: input.tags.map((tagId) => ({
          orgId: input.orgId,
          ticketId: ticket.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.ticketComment.create({
      data: {
        orgId: input.orgId,
        ticketId: ticket.id,
        authorId: input.assigneeId ?? input.requesterId,
        body: "Initial triage completed.",
        isInternal: true,
      },
    });

    await prisma.ticketAttachment.create({
      data: {
        orgId: input.orgId,
        ticketId: ticket.id,
        filename: "diagnostic-output.txt",
        sizeBytes: 2048,
        url: `/uploads/tickets/${ticket.id}/diagnostic-output.txt`,
        uploadedById: input.assigneeId ?? input.requesterId,
      },
    });

    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        actorUserId: input.assigneeId ?? input.requesterId,
        action: "TICKET_CREATED",
        entityType: "Ticket",
        entityId: ticket.id,
        metadata: {
          key: ticket.key,
        },
        createdAt: input.createdAt,
      },
    });

    return ticket;
  }

  const acmeTickets = await Promise.all([
    createTicketForOrg({
      orgId: acme.id,
      orgSlug: acme.slug,
      number: 1,
      title: "VPN disconnects every hour",
      description: "User reports recurring VPN disconnect while on home network.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      requesterId: userByEmail["acme.requester@demo.local"].id,
      assigneeId: userByEmail["acme.agent@demo.local"].id,
      teamId: acmeTeam.id,
      categoryId: acmeNetwork.id,
      dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      tags: [acmeTags[1].id],
    }),
    createTicketForOrg({
      orgId: acme.id,
      orgSlug: acme.slug,
      number: 2,
      title: "Laptop battery drains quickly",
      description: "Battery drains from 100% to 20% in two hours.",
      status: "OPEN",
      priority: "MEDIUM",
      requesterId: userByEmail["acme.requester@demo.local"].id,
      assigneeId: userByEmail["shared.agent@demo.local"].id,
      teamId: acmeTeam.id,
      categoryId: acmeHardware.id,
      relatedAssetId: acmeLaptop.id,
      dueAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      tags: [acmeTags[0].id],
    }),
    createTicketForOrg({
      orgId: acme.id,
      orgSlug: acme.slug,
      number: 3,
      title: "Need Finance app role",
      description: "Requester needs read-only role in Finance app for quarter close.",
      status: "ON_HOLD",
      priority: "CRITICAL",
      requesterId: userByEmail["acme.requester@demo.local"].id,
      assigneeId: userByEmail["acme.agent@demo.local"].id,
      teamId: acmeTeam.id,
      categoryId: acmeAccess.id,
      dueAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
      tags: [acmeTags[2].id],
    }),
    createTicketForOrg({
      orgId: acme.id,
      orgSlug: acme.slug,
      number: 4,
      title: "Server 09 backup job failed",
      description: "Nightly backup failed with disk full warning.",
      status: "RESOLVED",
      priority: "HIGH",
      requesterId: userByEmail["acme.admin@demo.local"].id,
      assigneeId: userByEmail["shared.agent@demo.local"].id,
      teamId: acmeTeam.id,
      categoryId: acmeHardware.id,
      relatedAssetId: acmeServer.id,
      dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      tags: [acmeTags[1].id],
    }),
  ]);

  const globexTickets = await Promise.all([
    createTicketForOrg({
      orgId: globex.id,
      orgSlug: globex.slug,
      number: 1,
      title: "Grant CRM admin role",
      description: "Temporary admin role required for migration.",
      status: "OPEN",
      priority: "CRITICAL",
      requesterId: userByEmail["globex.requester@demo.local"].id,
      assigneeId: userByEmail["globex.agent@demo.local"].id,
      teamId: globexTeam.id,
      categoryId: globexIdentity.id,
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      tags: [globexTags[0].id],
    }),
    createTicketForOrg({
      orgId: globex.id,
      orgSlug: globex.slug,
      number: 2,
      title: "CRM license assignment issue",
      description: "User cannot activate assigned CRM license.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      requesterId: userByEmail["globex.requester@demo.local"].id,
      assigneeId: userByEmail["shared.agent@demo.local"].id,
      teamId: globexTeam.id,
      categoryId: globexApps.id,
      relatedAssetId: globexLicense.id,
      dueAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      tags: [globexTags[1].id],
    }),
  ]);

  await prisma.organization.update({
    where: { id: acme.id },
    data: { nextTicketNumber: acmeTickets.length + 1 },
  });

  await prisma.organization.update({
    where: { id: globex.id },
    data: { nextTicketNumber: globexTickets.length + 1 },
  });

  await prisma.accessRequest.createMany({
    data: [
      {
        orgId: acme.id,
        requestType: "ADD_USER_TO_GROUP",
        status: "APPROVED",
        title: "Add user to Finance group",
        description: "Provision group membership for monthly close.",
        targetUpn: "acme.requester@demo.local",
        targetGroupId: "group-finance-approvers",
        requesterId: userByEmail["acme.requester@demo.local"].id,
        managerApproverId: userByEmail["manager@demo.local"].id,
        assignedToId: userByEmail["acme.agent@demo.local"].id,
        relatedTicketId: acmeTickets[2].id,
      },
      {
        orgId: acme.id,
        requestType: "REMOVE_FROM_GROUP",
        status: "SUBMITTED",
        title: "Remove contractor from Payroll group",
        description: "Contract ended; remove access.",
        targetUpn: "contractor@acme.local",
        targetGroupId: "group-payroll-editors",
        requesterId: userByEmail["acme.requester@demo.local"].id,
        managerApproverId: userByEmail["manager@demo.local"].id,
        assignedToId: userByEmail["acme.agent@demo.local"].id,
        relatedTicketId: acmeTickets[2].id,
      },
      {
        orgId: acme.id,
        requestType: "RESET_MFA",
        status: "SUBMITTED",
        title: "Reset MFA for Acme requester",
        description: "User replaced phone and needs MFA reset.",
        targetUpn: "acme.requester@demo.local",
        requesterId: userByEmail["acme.requester@demo.local"].id,
        managerApproverId: userByEmail["manager@demo.local"].id,
        assignedToId: userByEmail["acme.agent@demo.local"].id,
        relatedTicketId: acmeTickets[2].id,
      },
      {
        orgId: acme.id,
        requestType: "GRANT_APP_ROLE",
        status: "SUBMITTED",
        title: "Grant SAP Approver role",
        description: "Quarter-end close requires temporary approver access.",
        targetUpn: "acme.requester@demo.local",
        appRoleName: "SAP.Approver",
        requesterId: userByEmail["acme.requester@demo.local"].id,
        managerApproverId: userByEmail["manager@demo.local"].id,
        assignedToId: userByEmail["acme.agent@demo.local"].id,
        relatedTicketId: acmeTickets[2].id,
      },
      {
        orgId: globex.id,
        requestType: "RESET_MFA",
        status: "IN_PROGRESS",
        title: "Reset MFA for finance lead",
        description: "Lost authenticator device.",
        targetUpn: "globex.requester@demo.local",
        requesterId: userByEmail["globex.requester@demo.local"].id,
        managerApproverId: userByEmail["globex.admin@demo.local"].id,
        assignedToId: userByEmail["globex.agent@demo.local"].id,
        relatedTicketId: globexTickets[0].id,
      },
    ],
  });

  const acmeAccessRequest = await prisma.accessRequest.findFirst({
    where: { orgId: acme.id },
    orderBy: { createdAt: "desc" },
  });
  if (acmeAccessRequest) {
    await prisma.accessRequestAttachment.create({
      data: {
        orgId: acme.id,
        accessRequestId: acmeAccessRequest.id,
        filename: "manager-approval.txt",
        sizeBytes: 768,
        url: `/uploads/access/${acmeAccessRequest.id}/manager-approval.txt`,
        uploadedById: userByEmail["manager@demo.local"].id,
      },
    });
  }

  await prisma.knowledgeFeedback.createMany({
    data: [
      {
        orgId: acme.id,
        articleId: acmeKb[0].id,
        userId: userByEmail["acme.requester@demo.local"].id,
        helpful: true,
      },
      {
        orgId: acme.id,
        articleId: acmeKb[1].id,
        userId: userByEmail["acme.requester@demo.local"].id,
        helpful: false,
      },
      {
        orgId: globex.id,
        articleId: globexKb[0].id,
        userId: userByEmail["globex.requester@demo.local"].id,
        helpful: true,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        orgId: acme.id,
        userId: userByEmail["acme.agent@demo.local"].id,
        type: "ASSIGNMENT",
        title: "Assigned ticket ACME-1",
        message: "VPN disconnects every hour",
        link: `/tickets/${acmeTickets[0].id}`,
      },
      {
        orgId: acme.id,
        userId: userByEmail["acme.requester@demo.local"].id,
        type: "SLA_AT_RISK",
        title: "SLA at risk: ACME-1",
        message: "Ticket due soon",
        link: `/tickets/${acmeTickets[0].id}`,
      },
      {
        orgId: globex.id,
        userId: userByEmail["globex.agent@demo.local"].id,
        type: "ACCESS_REQUEST",
        title: "Access request submitted",
        message: "Grant CRM admin role",
        link: "/access-requests",
      },
    ],
  });

  await prisma.emailQueue.createMany({
    data: [
      {
        orgId: acme.id,
        toEmail: "acme.agent@demo.local",
        subject: "SLA alert: ACME-1",
        body: "Ticket ACME-1 is at risk.",
        status: "PENDING",
        createdById: userByEmail["acme.admin@demo.local"].id,
      },
      {
        orgId: globex.id,
        toEmail: "globex.agent@demo.local",
        subject: "Access request pending",
        body: "Review new request.",
        status: "PENDING",
        createdById: userByEmail["globex.admin@demo.local"].id,
      },
    ],
  });

  await prisma.invitation.createMany({
    data: [
      {
        orgId: acme.id,
        email: "new.requester@demo.local",
        role: "Requester",
        token: "seed-invite-acme-requester",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: userByEmail["acme.admin@demo.local"].id,
      },
      {
        orgId: globex.id,
        email: "new.agent@demo.local",
        role: "Agent",
        token: "seed-invite-globex-agent",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: userByEmail["globex.admin@demo.local"].id,
      },
    ],
  });

  await prisma.workflowRun.createMany({
    data: [
      {
        orgId: acme.id,
        runType: "MANUAL",
        status: "COMPLETED",
        summary: JSON.stringify({ scanned: 4, assignedCount: 1, atRiskCount: 1, breachedCount: 1 }),
        triggeredById: userByEmail["acme.admin@demo.local"].id,
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3000),
      },
      {
        orgId: globex.id,
        runType: "MANUAL",
        status: "COMPLETED",
        summary: JSON.stringify({ scanned: 2, assignedCount: 0, atRiskCount: 1, breachedCount: 0 }),
        triggeredById: userByEmail["globex.admin@demo.local"].id,
        startedAt: new Date(Date.now() - 60 * 60 * 1000),
        finishedAt: new Date(Date.now() - 60 * 60 * 1000 + 2000),
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        orgId: acme.id,
        actorUserId: userByEmail["acme.admin@demo.local"].id,
        action: "SEED_BOOTSTRAP",
        entityType: "System",
        metadata: { source: "prisma/seed.ts" },
      },
      {
        orgId: globex.id,
        actorUserId: userByEmail["globex.admin@demo.local"].id,
        action: "SEED_BOOTSTRAP",
        entityType: "System",
        metadata: { source: "prisma/seed.ts" },
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo password for all accounts: DemoPass123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
