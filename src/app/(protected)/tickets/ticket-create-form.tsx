"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ticketCreateSchema } from "@/lib/validation/schemas";
import { createTicket } from "@/server/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FormValues = z.input<typeof ticketCreateSchema>;

type TicketCreateFormProps = {
  users: Array<{ id: string; name: string | null; role: string }>;
  teams: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; keywords: string | null }>;
  assets: Array<{ id: string; assetTag: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  suggestedArticles: Array<{ id: string; title: string; slug: string; categoryId: string | null }>;
};

export function TicketCreateForm({ users, teams, categories, assets, tags, suggestedArticles }: TicketCreateFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      categoryId: "",
      requesterId: "",
      assigneeId: "",
      teamId: "",
      dueAt: "",
      relatedAssetId: "",
      tagIds: [],
    },
  });

  const currentCategoryId = watch("categoryId");
  const title = watch("title");

  const matchedArticles = useMemo(() => {
    const categoryMatches = suggestedArticles.filter((article) => article.categoryId && article.categoryId === currentCategoryId);
    if (categoryMatches.length) {
      return categoryMatches.slice(0, 3);
    }

    const lowered = title.toLowerCase();
    if (!lowered.trim()) return [];

    return suggestedArticles
      .filter((article) => article.title.toLowerCase().includes(lowered) || lowered.includes(article.title.toLowerCase()))
      .slice(0, 3);
  }, [currentCategoryId, title, suggestedArticles]);

  const onSubmit = async (values: FormValues) => {
    setMessage(null);
    setError(null);

    const normalized = {
      ...values,
      categoryId: values.categoryId || undefined,
      requesterId: values.requesterId || undefined,
      assigneeId: values.assigneeId || undefined,
      teamId: values.teamId || undefined,
      dueAt: values.dueAt || undefined,
      relatedAssetId: values.relatedAssetId || undefined,
      tagIds: Array.isArray(values.tagIds) ? values.tagIds : values.tagIds ? [values.tagIds] : [],
    };

    const result = await createTicket(normalized);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Created ticket ${result.data.key}`);
    router.refresh();
  };

  const requesters = users.filter((user) => user.role === "Requester" || user.role === "OrgAdmin" || user.role === "Agent");
  const assignees = users.filter((user) => user.role === "Agent" || user.role === "OrgAdmin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create ticket</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-rose-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} />
            {errors.description && <p className="text-xs text-rose-600">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" {...register("priority")}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" {...register("categoryId")}>
              <option value="">None</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requesterId">Requester</Label>
            <Select id="requesterId" {...register("requesterId")}>
              <option value="">Current user</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name ?? "Unnamed"} ({requester.role})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigneeId">Assignee</Label>
            <Select id="assigneeId" {...register("assigneeId")}>
              <option value="">Auto / Unassigned</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name ?? "Unnamed"}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamId">Team</Label>
            <Select id="teamId" {...register("teamId")}>
              <option value="">None</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedAssetId">Related asset</Label>
            <Select id="relatedAssetId" {...register("relatedAssetId")}>
              <option value="">None</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag} - {asset.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueAt">Due at</Label>
            <Input id="dueAt" type="datetime-local" {...register("dueAt")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Select id="tags" multiple className="h-24" {...register("tagIds")}>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="md:col-span-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Suggested articles</p>
            {matchedArticles.length ? (
              <ul className="space-y-1 text-sm">
                {matchedArticles.map((article) => (
                  <li key={article.id}>
                    <Link href={`/knowledge?slug=${article.slug}`} className="text-sky-700 hover:text-sky-800">
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No suggestions yet.</p>
            )}
          </div>

          {error && <p className="text-sm text-rose-600 md:col-span-2">{error}</p>}
          {message && <p className="text-sm text-emerald-600 md:col-span-2">{message}</p>}

          <div className="md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create ticket"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
