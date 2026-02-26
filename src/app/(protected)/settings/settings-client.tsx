"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCannedResponse, deleteCannedResponse } from "@/server/actions/ticket-actions";
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  updateNotificationPreferences,
  updateOrganizationProfile,
  upsertSlaRule,
} from "@/server/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SettingsClientProps = {
  org: {
    name: string;
    logoUrl: string | null;
    supportEmail: string | null;
    notificationEmail: string | null;
    brandPrimaryColor: string | null;
    brandSecondaryColor: string | null;
  };
  slaRules: Array<{ priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; responseMinutes: number; resolutionMinutes: number }>;
  categories: Array<{ id: string; name: string; keywords: string | null }>;
  tags: Array<{ id: string; name: string }>;
  notificationPreference: {
    emailAssignments: boolean;
    emailMentions: boolean;
    emailSlaAlerts: boolean;
    inAppEnabled: boolean;
  } | null;
  cannedResponses: Array<{ id: string; title: string; content: string }>;
  canManageSettings: boolean;
};

export function SettingsClient({
  org,
  slaRules,
  categories,
  tags,
  notificationPreference,
  cannedResponses,
  canManageSettings,
}: SettingsClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [orgState, setOrgState] = useState({
    name: org.name,
    logoUrl: org.logoUrl ?? "",
    supportEmail: org.supportEmail ?? "",
    notificationEmail: org.notificationEmail ?? "",
    brandPrimaryColor: org.brandPrimaryColor ?? "#0f172a",
    brandSecondaryColor: org.brandSecondaryColor ?? "#0284c7",
  });

  const [newCategory, setNewCategory] = useState({ name: "", keywords: "" });
  const [newTag, setNewTag] = useState({ name: "", color: "#0ea5e9" });
  const [newCannedResponse, setNewCannedResponse] = useState({ title: "", content: "" });

  const [preferences, setPreferences] = useState(
    notificationPreference ?? {
      emailAssignments: true,
      emailMentions: true,
      emailSlaAlerts: true,
      inAppEnabled: true,
    },
  );

  const [slaState, setSlaState] = useState<Record<string, { responseMinutes: number; resolutionMinutes: number }>>(() => {
    const base: Record<string, { responseMinutes: number; resolutionMinutes: number }> = {
      LOW: { responseMinutes: 240, resolutionMinutes: 2880 },
      MEDIUM: { responseMinutes: 120, resolutionMinutes: 1440 },
      HIGH: { responseMinutes: 60, resolutionMinutes: 480 },
      CRITICAL: { responseMinutes: 30, resolutionMinutes: 240 },
    };

    for (const rule of slaRules) {
      base[rule.priority] = {
        responseMinutes: rule.responseMinutes,
        resolutionMinutes: rule.resolutionMinutes,
      };
    }

    return base;
  });

  const runAction = async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
    setError(null);
    setMessage(null);

    const result = await action();
    if (!result.ok) {
      setError(result.error ?? "Action failed");
      return;
    }

    setMessage(successMessage);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization profile & branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={orgState.name} onChange={(event) => setOrgState((state) => ({ ...state, name: event.target.value }))} />
            </div>
            <div>
              <Label>Logo URL (stub)</Label>
              <Input value={orgState.logoUrl} onChange={(event) => setOrgState((state) => ({ ...state, logoUrl: event.target.value }))} />
            </div>
            <div>
              <Label>Support email</Label>
              <Input value={orgState.supportEmail} onChange={(event) => setOrgState((state) => ({ ...state, supportEmail: event.target.value }))} />
            </div>
            <div>
              <Label>Notification email</Label>
              <Input
                value={orgState.notificationEmail}
                onChange={(event) => setOrgState((state) => ({ ...state, notificationEmail: event.target.value }))}
              />
            </div>
            <div>
              <Label>Primary brand color</Label>
              <Input
                value={orgState.brandPrimaryColor}
                onChange={(event) => setOrgState((state) => ({ ...state, brandPrimaryColor: event.target.value }))}
              />
            </div>
            <div>
              <Label>Secondary brand color</Label>
              <Input
                value={orgState.brandSecondaryColor}
                onChange={(event) => setOrgState((state) => ({ ...state, brandSecondaryColor: event.target.value }))}
              />
            </div>
          </div>
          <Button
            onClick={() =>
              runAction(
                () =>
                  updateOrganizationProfile({
                    ...orgState,
                  }),
                "Organization profile saved.",
              )
            }
            disabled={!canManageSettings}
          >
            Save organization profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SLA rules by priority</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((priority) => (
            <div key={priority} className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-5 md:items-end">
              <p className="font-medium text-slate-700">{priority}</p>
              <div>
                <Label>Response (min)</Label>
                <Input
                  value={String(slaState[priority].responseMinutes)}
                  onChange={(event) =>
                    setSlaState((state) => ({
                      ...state,
                      [priority]: {
                        ...state[priority],
                        responseMinutes: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Label>Resolution (min)</Label>
                <Input
                  value={String(slaState[priority].resolutionMinutes)}
                  onChange={(event) =>
                    setSlaState((state) => ({
                      ...state,
                      [priority]: {
                        ...state[priority],
                        resolutionMinutes: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() =>
                    runAction(
                      () =>
                        upsertSlaRule({
                          priority,
                          responseMinutes: slaState[priority].responseMinutes,
                          resolutionMinutes: slaState[priority].resolutionMinutes,
                        }),
                      `${priority} SLA updated.`,
                    )
                  }
                  disabled={!canManageSettings}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input
                placeholder="Category name"
                value={newCategory.name}
                onChange={(event) => setNewCategory((state) => ({ ...state, name: event.target.value }))}
              />
              <Input
                placeholder="Keywords (comma separated)"
                value={newCategory.keywords}
                onChange={(event) => setNewCategory((state) => ({ ...state, keywords: event.target.value }))}
              />
              <Button
                onClick={() =>
                  runAction(
                    () =>
                      createCategory({
                        name: newCategory.name,
                        keywords: newCategory.keywords,
                      }),
                    "Category created.",
                  )
                }
                disabled={!canManageSettings}
              >
                Add category
              </Button>
            </div>

            <ul className="space-y-1 text-sm">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                  <span>
                    {category.name}
                    {category.keywords ? ` (${category.keywords})` : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runAction(() => deleteCategory({ id: category.id }), "Category removed.")}
                    disabled={!canManageSettings}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input placeholder="Tag name" value={newTag.name} onChange={(event) => setNewTag((state) => ({ ...state, name: event.target.value }))} />
              <Input placeholder="Tag color" value={newTag.color} onChange={(event) => setNewTag((state) => ({ ...state, color: event.target.value }))} />
              <Button
                onClick={() =>
                  runAction(
                    () =>
                      createTag({
                        name: newTag.name,
                        color: newTag.color,
                      }),
                    "Tag created.",
                  )
                }
                disabled={!canManageSettings}
              >
                Add tag
              </Button>
            </div>

            <ul className="space-y-1 text-sm">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                  <span>{tag.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runAction(() => deleteTag({ id: tag.id }), "Tag removed.")}
                    disabled={!canManageSettings}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              ["emailAssignments", "Email on assignments"],
              ["emailMentions", "Email on mentions"],
              ["emailSlaAlerts", "Email on SLA alerts"],
              ["inAppEnabled", "In-app notifications"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={preferences[key]}
                onChange={(event) =>
                  setPreferences((state) => ({
                    ...state,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}

          <Button onClick={() => runAction(() => updateNotificationPreferences(preferences), "Notification preferences saved.")}>
            Save preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canned responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Title"
              value={newCannedResponse.title}
              onChange={(event) => setNewCannedResponse((state) => ({ ...state, title: event.target.value }))}
            />
            <Button
              onClick={() =>
                runAction(
                  () =>
                    createCannedResponse({
                      title: newCannedResponse.title,
                      content: newCannedResponse.content,
                    }),
                  "Canned response created.",
                )
              }
            >
              Add response
            </Button>
          </div>
          <Textarea
            placeholder="Response markdown/content"
            value={newCannedResponse.content}
            onChange={(event) => setNewCannedResponse((state) => ({ ...state, content: event.target.value }))}
          />

          <ul className="space-y-1 text-sm">
            {cannedResponses.map((response) => (
              <li key={response.id} className="rounded border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{response.title}</p>
                  <Button size="sm" variant="ghost" onClick={() => runAction(() => deleteCannedResponse(response.id), "Canned response removed.")}>
                    Remove
                  </Button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{response.content}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
