"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvitation } from "@/server/actions/auth-actions";
import { updateAgentCapacity, updateOrganizationMemberRole } from "@/server/actions/user-team-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type MemberRow = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: "OrgAdmin" | "Agent" | "Requester" | "ReadOnly";
  agentCapacity: number;
  isCurrentUser: boolean;
};

type UsersClientProps = {
  members: MemberRow[];
  canManage: boolean;
};

export function UsersClient({ members, canManage }: UsersClientProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Agent" | "Requester" | "ReadOnly">("Agent");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runInvite = async () => {
    setError(null);
    setMessage(null);
    setInviteLink(null);

    const result = await createInvitation({
      email: inviteEmail,
      role: inviteRole,
      expiresInDays: 7,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setInviteLink(result.data.inviteLink);
    setMessage("Invitation created.");
    setInviteEmail("");
    router.refresh();
  };

  const updateRole = async (memberId: string, role: MemberRow["role"]) => {
    setError(null);
    const result = await updateOrganizationMemberRole({ memberId, role });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Role updated.");
    router.refresh();
  };

  const updateCapacity = async (memberId: string, agentCapacity: number) => {
    setError(null);
    const result = await updateAgentCapacity({ memberId, agentCapacity });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Capacity updated.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="new.agent@company.local" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "Agent" | "Requester" | "ReadOnly")}>
                <option value="Agent">Agent</option>
                <option value="Requester">Requester</option>
                <option value="ReadOnly">ReadOnly</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={runInvite} disabled={!canManage}>
                Create invite
              </Button>
            </div>
          </div>

          {inviteLink ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
              Invite link: <span className="font-medium">{inviteLink}</span>
            </div>
          ) : null}
          {!canManage ? <p className="text-xs text-slate-500">Only OrgAdmin can invite users.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Agent capacity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <UserRow
                  key={member.memberId}
                  member={member}
                  canManage={canManage}
                  onUpdateRole={updateRole}
                  onUpdateCapacity={updateCapacity}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}

function UserRow({
  member,
  canManage,
  onUpdateRole,
  onUpdateCapacity,
}: {
  member: MemberRow;
  canManage: boolean;
  onUpdateRole: (memberId: string, role: MemberRow["role"]) => Promise<void>;
  onUpdateCapacity: (memberId: string, agentCapacity: number) => Promise<void>;
}) {
  const [role, setRole] = useState<MemberRow["role"]>(member.role);
  const [capacity, setCapacity] = useState(String(member.agentCapacity));

  return (
    <TableRow>
      <TableCell>{member.name}</TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>
        <Select value={role} onChange={(event) => setRole(event.target.value as MemberRow["role"])}>
          <option value="OrgAdmin">OrgAdmin</option>
          <option value="Agent">Agent</option>
          <option value="Requester">Requester</option>
          <option value="ReadOnly">ReadOnly</option>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={capacity} onChange={(event) => setCapacity(event.target.value)} className="w-24" />
      </TableCell>
      <TableCell className="space-x-2">
        <Button size="sm" variant="outline" onClick={() => onUpdateRole(member.memberId, role)} disabled={!canManage}>
          Save role
        </Button>
        <Button size="sm" onClick={() => onUpdateCapacity(member.memberId, Number(capacity))}>
          Save capacity
        </Button>
      </TableCell>
    </TableRow>
  );
}
