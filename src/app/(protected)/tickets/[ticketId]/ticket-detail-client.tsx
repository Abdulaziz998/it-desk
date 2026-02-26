"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTicketComment,
  addTicketWatcher,
  createTicketAttachmentStub,
  removeTicketWatcher,
  updateTicket,
} from "@/server/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TicketDetailClientProps = {
  ticket: {
    id: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    teamId: string | null;
    dueAt: Date | null;
  };
  members: Array<{ userId: string; name: string | null; role: string }>;
  teams: Array<{ id: string; name: string }>;
  watchers: Array<{ userId: string; name: string | null }>;
  cannedResponses: Array<{ id: string; title: string; content: string }>;
};

export function TicketDetailClient({ ticket, members, teams, watchers, cannedResponses }: TicketDetailClientProps) {
  const router = useRouter();

  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId ?? "");
  const [teamId, setTeamId] = useState(ticket.teamId ?? "");
  const [dueAt, setDueAt] = useState(ticket.dueAt ? new Date(ticket.dueAt).toISOString().slice(0, 16) : "");
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [selectedCanned, setSelectedCanned] = useState("");
  const [watcherUserId, setWatcherUserId] = useState("");
  const [attachmentName, setAttachmentName] = useState("diagnostic.txt");
  const [attachmentSize, setAttachmentSize] = useState("1024");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignees = useMemo(
    () => members.filter((member) => member.role === "Agent" || member.role === "OrgAdmin"),
    [members],
  );

  const applyCannedResponse = () => {
    const chosen = cannedResponses.find((response) => response.id === selectedCanned);
    if (!chosen) return;
    setComment((current) => (current ? `${current}\n\n${chosen.content}` : chosen.content));
  };

  const onUpdateTicket = async () => {
    setError(null);
    setMessage(null);

    const result = await updateTicket({
      ticketId: ticket.id,
      status,
      priority,
      assigneeId: assigneeId || null,
      teamId: teamId || null,
      dueAt: dueAt || null,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Ticket updated.");
    router.refresh();
  };

  const onAddComment = async () => {
    setError(null);
    setMessage(null);

    const result = await addTicketComment({
      ticketId: ticket.id,
      body: comment,
      isInternal,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setComment("");
    setMessage("Comment added.");
    router.refresh();
  };

  const onAddWatcher = async () => {
    if (!watcherUserId) {
      setError("Select a watcher.");
      return;
    }

    const result = await addTicketWatcher({
      ticketId: ticket.id,
      userId: watcherUserId,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Watcher added.");
    setWatcherUserId("");
    router.refresh();
  };

  const onRemoveWatcher = async (userId: string) => {
    const result = await removeTicketWatcher({
      ticketId: ticket.id,
      userId,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Watcher removed.");
    router.refresh();
  };

  const onAttach = async () => {
    const result = await createTicketAttachmentStub({
      ticketId: ticket.id,
      filename: attachmentName,
      sizeBytes: Number(attachmentSize),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Attachment metadata added.");
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Update ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="ON_HOLD">On hold</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assignee</Label>
              <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">Unassigned</option>
                {assignees.map((assignee) => (
                  <option key={assignee.userId} value={assignee.userId}>
                    {assignee.name ?? "Unnamed"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
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
            <div className="space-y-1 md:col-span-2">
              <Label>Due at</Label>
              <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </div>
          </div>
          <Button onClick={onUpdateTicket}>Save changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Canned response</Label>
            <div className="flex gap-2">
              <Select value={selectedCanned} onChange={(event) => setSelectedCanned(event.target.value)}>
                <option value="">Select response</option>
                {cannedResponses.map((response) => (
                  <option key={response.id} value={response.id}>
                    {response.title}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={applyCannedResponse}>
                Insert
              </Button>
            </div>
          </div>

          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add ticket update..." />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
            Internal comment
          </label>

          <Button onClick={onAddComment}>Post comment</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watchers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={watcherUserId} onChange={(event) => setWatcherUserId(event.target.value)}>
              <option value="">Add watcher</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name ?? "Unnamed"}
                </option>
              ))}
            </Select>
            <Button onClick={onAddWatcher}>Add</Button>
          </div>

          <ul className="space-y-1 text-sm">
            {watchers.map((watcher) => (
              <li key={watcher.userId} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                <span>{watcher.name ?? "Unnamed"}</span>
                <Button variant="ghost" size="sm" onClick={() => onRemoveWatcher(watcher.userId)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachment metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="filename.log" />
          <Input value={attachmentSize} onChange={(event) => setAttachmentSize(event.target.value)} placeholder="size bytes" />
          <Button onClick={onAttach}>Add attachment stub</Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600 lg:col-span-2">{error}</p>}
      {message && <p className="text-sm text-emerald-600 lg:col-span-2">{message}</p>}
    </div>
  );
}
