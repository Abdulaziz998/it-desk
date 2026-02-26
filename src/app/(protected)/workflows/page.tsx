import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { WorkflowsClient } from "@/app/(protected)/workflows/workflows-client";

export default async function WorkflowsPage() {
  const context = await requirePagePermission("settings.manage");

  const [rules, categories, teams, runs] = await Promise.all([
    prisma.autoAssignRule.findMany({
      where: {
        orgId: context.orgId,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.category.findMany({
      where: { orgId: context.orgId },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { orgId: context.orgId },
      orderBy: { name: "asc" },
    }),
    prisma.workflowRun.findMany({
      where: { orgId: context.orgId },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <WorkflowsClient
      rules={rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        categoryName: rule.category?.name ?? "Any",
        teamName: rule.team?.name ?? "None",
        strategy: rule.assignmentStrategy,
        isActive: rule.isActive,
      }))}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      runs={runs.map((run) => ({
        id: run.id,
        status: run.status,
        summary: run.summary,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      }))}
    />
  );
}
