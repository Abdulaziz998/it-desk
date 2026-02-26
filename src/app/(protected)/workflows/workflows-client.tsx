"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAutoAssignRule, deleteAutoAssignRule, toggleAutoAssignRule } from "@/server/actions/workflow-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type WorkflowsClientProps = {
  rules: Array<{
    id: string;
    name: string;
    categoryName: string;
    teamName: string;
    strategy: "ROUND_ROBIN" | "TEAM_DEFAULT";
    isActive: boolean;
  }>;
  categories: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  runs: Array<{ id: string; status: string; summary: string | null; startedAt: Date; finishedAt: Date | null }>;
};

export function WorkflowsClient({ rules, categories, teams, runs }: WorkflowsClientProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [strategy, setStrategy] = useState<"ROUND_ROBIN" | "TEAM_DEFAULT">("ROUND_ROBIN");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createRule = async () => {
    const result = await createAutoAssignRule({
      name,
      categoryId: categoryId || undefined,
      teamId: teamId || undefined,
      assignmentStrategy: strategy,
      isActive: true,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Rule created.");
    setName("");
    setCategoryId("");
    setTeamId("");
    router.refresh();
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    const result = await toggleAutoAssignRule({ ruleId, isActive: !isActive });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Rule updated.");
    router.refresh();
  };

  const removeRule = async (ruleId: string) => {
    const result = await deleteAutoAssignRule({ ruleId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Rule deleted.");
    router.refresh();
  };

  const runNow = async () => {
    setError(null);
    setMessage(null);

    const response = await fetch("/api/workflows/run", {
      method: "POST",
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Workflow failed");
      return;
    }

    setMessage(`Workflow completed. Scanned ${payload.summary.scanned}, assigned ${payload.summary.assignedCount}.`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual workflow run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-slate-600">
            This endpoint simulates scheduled jobs for auto-assignment and SLA escalation. Trigger for MVP via POST /api/workflows/run.
          </p>
          <Button onClick={runNow}>Run now</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create auto-assign rule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Hardware incidents" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Any category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Team</Label>
            <Select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Strategy</Label>
            <Select value={strategy} onChange={(event) => setStrategy(event.target.value as "ROUND_ROBIN" | "TEAM_DEFAULT") }>
              <option value="ROUND_ROBIN">Round robin</option>
              <option value="TEAM_DEFAULT">Team default</option>
            </Select>
          </div>

          <div className="md:col-span-4">
            <Button onClick={createRule}>Create rule</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-assign rules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className="rounded border border-slate-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium">{rule.name}</p>
                  <Badge variant={rule.isActive ? "success" : "default"}>{rule.isActive ? "Active" : "Paused"}</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  Category: {rule.categoryName} | Team: {rule.teamName} | Strategy: {rule.strategy}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleRule(rule.id, rule.isActive)}>
                    {rule.isActive ? "Pause" : "Activate"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeRule(rule.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {!rules.length ? <li className="text-sm text-slate-500">No rules yet.</li> : null}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent workflow runs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id} className="rounded border border-slate-200 p-2">
                <p>
                  {run.status} | {formatDate(run.startedAt)}
                </p>
                <p className="text-slate-600">{run.summary ?? "No summary"}</p>
              </li>
            ))}
            {!runs.length ? <li className="text-slate-500">No workflow runs yet.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
