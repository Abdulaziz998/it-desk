import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

export async function startJobRun(input: { orgId?: string; jobType: string; message?: string }) {
  let resolvedOrgId: string | undefined;
  if (input.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true },
    });
    resolvedOrgId = org?.id;
  }

  return prisma.jobRun.create({
    data: {
      orgId: resolvedOrgId,
      jobType: input.jobType,
      status: "RUNNING",
      startedAt: new Date(),
      message: input.message,
    },
  });
}

export async function completeJobRun(input: {
  id: string;
  status?: "SUCCESS" | "FAILED";
  message?: string;
  jsonResult?: unknown;
}) {
  return prisma.jobRun.update({
    where: { id: input.id },
    data: {
      status: input.status ?? "SUCCESS",
      finishedAt: new Date(),
      message: input.message,
      jsonResult: toJson(input.jsonResult),
    },
  });
}

export async function failJobRun(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return prisma.jobRun.update({
    where: { id },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      message,
      jsonResult: toJson({
        error: message,
      }),
    },
  });
}
