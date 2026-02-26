"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit";
import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import { kbArticleSchema, kbFeedbackSchema } from "@/lib/validation/schemas";
import { runSafeAction } from "@/server/action-utils";

const updateArticleSchema = kbArticleSchema.extend({
  articleId: z.string(),
});

export async function createKnowledgeArticle(input: unknown) {
  return runSafeAction("createKnowledgeArticle", async () => {
    const context = await requirePermission("kb.write");
    const parsed = kbArticleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid article payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const article = await prisma.knowledgeArticle.create({
      data: {
        orgId: context.orgId,
        title: parsed.data.title,
        slug: parsed.data.slug,
        contentMarkdown: parsed.data.contentMarkdown,
        categoryId: parsed.data.categoryId || null,
        isPublished: parsed.data.isPublished,
        authorId: context.userId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "KB_ARTICLE_CREATED",
      entityType: "KnowledgeArticle",
      entityId: article.id,
      metadata: {
        slug: article.slug,
      },
    });

    return article;
  });
}

export async function updateKnowledgeArticle(input: unknown) {
  return runSafeAction("updateKnowledgeArticle", async () => {
    const context = await requirePermission("kb.write");
    const parsed = updateArticleSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid article update", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const existing = await prisma.knowledgeArticle.findFirst({
      where: {
        id: parsed.data.articleId,
        orgId: context.orgId,
      },
    });

    if (!existing) {
      throw new AppError("Article not found", "NOT_FOUND", 404);
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug,
        contentMarkdown: parsed.data.contentMarkdown,
        categoryId: parsed.data.categoryId || null,
        isPublished: parsed.data.isPublished,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "KB_ARTICLE_UPDATED",
      entityType: "KnowledgeArticle",
      entityId: updated.id,
      beforeData: {
        title: existing.title,
        slug: existing.slug,
      },
      afterData: {
        title: updated.title,
        slug: updated.slug,
      },
    });

    return updated;
  });
}

export async function deleteKnowledgeArticle(articleId: string) {
  return runSafeAction("deleteKnowledgeArticle", async () => {
    const context = await requirePermission("kb.write");

    const deleted = await prisma.knowledgeArticle.deleteMany({
      where: {
        orgId: context.orgId,
        id: articleId,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "KB_ARTICLE_DELETED",
      entityType: "KnowledgeArticle",
      entityId: articleId,
    });

    return { deleted: deleted.count > 0 };
  });
}

export async function submitKnowledgeFeedback(input: unknown) {
  return runSafeAction("submitKnowledgeFeedback", async () => {
    const context = await requireAuthContext();
    const parsed = kbFeedbackSchema.safeParse(input);

    if (!parsed.success) {
      throw new AppError("Invalid feedback payload", "VALIDATION_ERROR", 400, parsed.error.flatten());
    }

    const article = await prisma.knowledgeArticle.findFirst({
      where: {
        id: parsed.data.articleId,
        orgId: context.orgId,
      },
      select: {
        id: true,
      },
    });

    if (!article) {
      throw new AppError("Article not found", "NOT_FOUND", 404);
    }

    const feedback = await prisma.knowledgeFeedback.create({
      data: {
        orgId: context.orgId,
        articleId: article.id,
        userId: context.userId,
        helpful: parsed.data.helpful,
      },
    });

    await recordAuditLog({
      orgId: context.orgId,
      actorUserId: context.userId,
      action: "KB_FEEDBACK_SUBMITTED",
      entityType: "KnowledgeArticle",
      entityId: article.id,
      metadata: {
        feedbackId: feedback.id,
        helpful: feedback.helpful,
      },
    });

    return feedback;
  });
}
