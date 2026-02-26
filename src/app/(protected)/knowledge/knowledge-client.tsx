"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  submitKnowledgeFeedback,
  updateKnowledgeArticle,
} from "@/server/actions/knowledge-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Article = {
  id: string;
  title: string;
  slug: string;
  contentMarkdown: string;
  categoryId: string | null;
  isPublished: boolean;
  updatedAt: Date;
  helpful: number;
  notHelpful: number;
};

type KnowledgeClientProps = {
  articles: Article[];
  selectedArticle: Article | null;
  categories: Array<{ id: string; name: string }>;
  canManage: boolean;
};

export function KnowledgeClient({ articles, selectedArticle, categories, canManage }: KnowledgeClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit">(selectedArticle ? "edit" : "create");
  const [title, setTitle] = useState(selectedArticle?.title ?? "");
  const [slug, setSlug] = useState(selectedArticle?.slug ?? "");
  const [contentMarkdown, setContentMarkdown] = useState(selectedArticle?.contentMarkdown ?? "");
  const [categoryId, setCategoryId] = useState(selectedArticle?.categoryId ?? "");
  const [isPublished, setIsPublished] = useState(selectedArticle?.isPublished ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const switchToCreate = () => {
    setMode("create");
    setTitle("");
    setSlug("");
    setContentMarkdown("");
    setCategoryId("");
    setIsPublished(true);
  };

  const switchToEdit = () => {
    if (!selectedArticle) return;
    setMode("edit");
    setTitle(selectedArticle.title);
    setSlug(selectedArticle.slug);
    setContentMarkdown(selectedArticle.contentMarkdown);
    setCategoryId(selectedArticle.categoryId ?? "");
    setIsPublished(selectedArticle.isPublished);
  };

  const saveArticle = async () => {
    setError(null);
    setMessage(null);

    if (mode === "create") {
      const result = await createKnowledgeArticle({
        title,
        slug,
        contentMarkdown,
        categoryId: categoryId || undefined,
        isPublished,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Article created.");
      router.push(`/knowledge?slug=${result.data.slug}`);
      router.refresh();
      return;
    }

    if (!selectedArticle) {
      setError("No selected article to update.");
      return;
    }

    const result = await updateKnowledgeArticle({
      articleId: selectedArticle.id,
      title,
      slug,
      contentMarkdown,
      categoryId: categoryId || undefined,
      isPublished,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Article updated.");
    router.push(`/knowledge?slug=${result.data.slug}`);
    router.refresh();
  };

  const removeArticle = async () => {
    if (!selectedArticle) {
      setError("Select an article first.");
      return;
    }

    const result = await deleteKnowledgeArticle(selectedArticle.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Article deleted.");
    router.push("/knowledge");
    router.refresh();
  };

  const sendFeedback = async (helpful: boolean) => {
    if (!selectedArticle) return;
    const result = await submitKnowledgeFeedback({ articleId: selectedArticle.id, helpful });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Feedback submitted.");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/knowledge?slug=${article.slug}`}
                  className={`block rounded border px-3 py-2 text-sm ${selectedArticle?.id === article.id ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <p className="font-medium">{article.title}</p>
                  <p className="text-xs text-slate-500">/{article.slug}</p>
                </Link>
              </li>
            ))}
            {!articles.length ? <li className="text-sm text-slate-500">No articles found.</li> : null}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {selectedArticle ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{selectedArticle.title}</span>
                {selectedArticle.isPublished ? <Badge variant="success">Published</Badge> : <Badge>Draft</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose max-w-none prose-slate">
                <ReactMarkdown>{selectedArticle.contentMarkdown}</ReactMarkdown>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Helpful: {selectedArticle.helpful}</span>
                <span>Not helpful: {selectedArticle.notHelpful}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => sendFeedback(true)}>
                  Helpful
                </Button>
                <Button variant="outline" onClick={() => sendFeedback(false)}>
                  Not helpful
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">Select an article to preview.</CardContent>
          </Card>
        )}

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Manage article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant={mode === "create" ? "default" : "outline"} onClick={switchToCreate}>
                  Create
                </Button>
                <Button variant={mode === "edit" ? "default" : "outline"} onClick={switchToEdit} disabled={!selectedArticle}>
                  Edit selected
                </Button>
              </div>

              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Markdown content</Label>
                <Textarea value={contentMarkdown} onChange={(event) => setContentMarkdown(event.target.value)} className="min-h-56" />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
                Published
              </label>

              <div className="flex gap-2">
                <Button onClick={saveArticle}>{mode === "create" ? "Create article" : "Update article"}</Button>
                <Button variant="destructive" onClick={removeArticle} disabled={!selectedArticle}>
                  Delete selected
                </Button>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {message && <p className="text-sm text-emerald-600">{message}</p>}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
