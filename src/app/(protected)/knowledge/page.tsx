import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { KnowledgeClient } from "@/app/(protected)/knowledge/knowledge-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function searchArticles(orgId: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return prisma.knowledgeArticle.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        orgId: string;
        title: string;
        slug: string;
        contentMarkdown: string;
        categoryId: string | null;
        isPublished: boolean;
        authorId: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT *
      FROM "KnowledgeArticle"
      WHERE "orgId" = ${orgId}
      AND to_tsvector('english', coalesce("title", '') || ' ' || coalesce("contentMarkdown", '')) @@ plainto_tsquery('english', ${trimmed})
      ORDER BY "updatedAt" DESC
      LIMIT 50
    `);

    return rows;
  } catch {
    return prisma.knowledgeArticle.findMany({
      where: {
        orgId,
        OR: [{ title: { contains: trimmed, mode: "insensitive" } }, { contentMarkdown: { contains: trimmed, mode: "insensitive" } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePagePermission("kb.read");
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const selectedSlug = typeof params.slug === "string" ? params.slug : undefined;

  const [articles, categories, feedback] = await Promise.all([
    searchArticles(context.orgId, query),
    prisma.category.findMany({ where: { orgId: context.orgId }, orderBy: { name: "asc" } }),
    prisma.knowledgeFeedback.groupBy({
      by: ["articleId", "helpful"],
      where: {
        orgId: context.orgId,
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const feedbackMap = new Map<string, { helpful: number; notHelpful: number }>();
  for (const entry of feedback) {
    const current = feedbackMap.get(entry.articleId) ?? { helpful: 0, notHelpful: 0 };
    if (entry.helpful) {
      current.helpful = entry._count._all;
    } else {
      current.notHelpful = entry._count._all;
    }
    feedbackMap.set(entry.articleId, current);
  }

  const enriched = articles.map((article) => ({
    ...article,
    helpful: feedbackMap.get(article.id)?.helpful ?? 0,
    notHelpful: feedbackMap.get(article.id)?.notHelpful ?? 0,
  }));

  const selectedArticle = selectedSlug ? enriched.find((article) => article.slug === selectedSlug) ?? null : enriched[0] ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form className="flex gap-2">
            <Input name="q" defaultValue={query} placeholder="Search knowledge articles" />
            <Button type="submit">Search</Button>
            <Button asChild variant="outline">
              <a href="/knowledge">Reset</a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <KnowledgeClient
        articles={enriched}
        selectedArticle={selectedArticle}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        canManage={(await hasPermission(context.role, "kb.write"))}
      />
    </div>
  );
}
