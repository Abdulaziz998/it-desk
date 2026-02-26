"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateTickets } from "@/server/actions/ticket-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type TicketRow = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string;
  requesterName: string;
  categoryName: string;
  dueAt: Date | null;
  atRisk: boolean;
  breachedAt: Date | null;
};

type TicketListClientProps = {
  tickets: TicketRow[];
  assignees: Array<{ id: string; name: string | null }>;
};

export function TicketListClient({ tickets, assignees }: TicketListClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ASSIGN" | "SET_STATUS" | "SET_PRIORITY">("ASSIGN");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [status, setStatus] = useState<string>("OPEN");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allSelected = useMemo(() => tickets.length > 0 && selectedIds.length === tickets.length, [tickets.length, selectedIds.length]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(tickets.map((ticket) => ticket.id));
  };

  const toggleOne = (ticketId: string) => {
    setSelectedIds((current) => (current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId]));
  };

  const runBulkAction = async () => {
    setError(null);
    setMessage(null);

    if (!selectedIds.length) {
      setError("Select at least one ticket.");
      return;
    }

    const payload: {
      ticketIds: string[];
      action: "ASSIGN" | "SET_STATUS" | "SET_PRIORITY";
      assigneeId?: string;
      status?: "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    } = {
      ticketIds: selectedIds,
      action: bulkAction,
    };

    if (bulkAction === "ASSIGN") {
      if (!assigneeId) {
        setError("Choose an assignee.");
        return;
      }
      payload.assigneeId = assigneeId;
    }

    if (bulkAction === "SET_STATUS") {
      payload.status = status as "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "CLOSED";
    }

    if (bulkAction === "SET_PRIORITY") {
      payload.priority = priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    }

    const result = await bulkUpdateTickets(payload);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Updated ${result.data.count} tickets.`);
    setSelectedIds([]);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-5">
          <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "ASSIGN" | "SET_STATUS" | "SET_PRIORITY")}>
            <option value="ASSIGN">Assign tickets</option>
            <option value="SET_STATUS">Set status</option>
            <option value="SET_PRIORITY">Set priority</option>
          </Select>

          {bulkAction === "ASSIGN" ? (
            <Select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Choose assignee</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name ?? "Unnamed"}
                </option>
              ))}
            </Select>
          ) : null}

          {bulkAction === "SET_STATUS" ? (
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="ON_HOLD">On hold</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>
          ) : null}

          {bulkAction === "SET_PRIORITY" ? (
            <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          ) : null}

          <Button onClick={runBulkAction}>Run bulk action</Button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <Checkbox checked={selectedIds.includes(ticket.id)} onChange={() => toggleOne(ticket.id)} />
                </TableCell>
                <TableCell>
                  <Link className="font-medium text-sky-700 hover:text-sky-800" href={`/tickets/${ticket.id}`}>
                    {ticket.key}
                  </Link>
                  <p className="text-xs text-slate-600">{ticket.title}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={ticket.status === "OPEN" ? "warning" : ticket.status === "RESOLVED" ? "success" : "info"}>
                    {ticket.status}
                  </Badge>
                </TableCell>
                <TableCell>{ticket.priority}</TableCell>
                <TableCell>{ticket.assigneeName}</TableCell>
                <TableCell>{ticket.requesterName}</TableCell>
                <TableCell>{ticket.categoryName}</TableCell>
                <TableCell>
                  {formatDate(ticket.dueAt)}
                  {ticket.breachedAt ? <p className="text-xs text-rose-600">Breached</p> : null}
                  {ticket.atRisk && !ticket.breachedAt ? <p className="text-xs text-amber-600">At risk</p> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
