"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addTeamMember, createTeam, removeTeamMember } from "@/server/actions/user-team-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Member = {
  id: string;
  name: string;
  role: string;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    memberId: string;
    teamMemberId: string;
    name: string;
    role: string;
  }>;
};

export function TeamsClient({ teams, members }: { teams: Team[]; members: Member[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCreateTeam = async () => {
    setMessage(null);
    setError(null);

    const result = await createTeam({
      name,
      description,
      memberIds: selectedMembers,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setName("");
    setDescription("");
    setSelectedMembers([]);
    setMessage("Team created.");
    router.refresh();
  };

  const onAddMember = async (teamId: string, memberId: string) => {
    const result = await addTeamMember({ teamId, memberId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Team member added.");
    router.refresh();
  };

  const onRemoveMember = async (teamId: string, memberId: string) => {
    const result = await removeTeamMember({ teamId, memberId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("Team member removed.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Initial members</Label>
              <Select
                multiple
                className="h-28"
                value={selectedMembers}
                onChange={(event) =>
                  setSelectedMembers(Array.from(event.target.selectedOptions).map((option) => option.value))
                }
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button onClick={onCreateTeam}>Create team</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} allMembers={members} onAddMember={onAddMember} onRemoveMember={onRemoveMember} />
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}

function TeamCard({
  team,
  allMembers,
  onAddMember,
  onRemoveMember,
}: {
  team: Team;
  allMembers: Member[];
  onAddMember: (teamId: string, memberId: string) => Promise<void>;
  onRemoveMember: (teamId: string, memberId: string) => Promise<void>;
}) {
  const [newMember, setNewMember] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">{team.description || "No description"}</p>

        <ul className="space-y-1 text-sm">
          {team.members.map((member) => (
            <li key={member.teamMemberId} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
              <span>
                {member.name} ({member.role})
              </span>
              <Button variant="ghost" size="sm" onClick={() => onRemoveMember(team.id, member.memberId)}>
                Remove
              </Button>
            </li>
          ))}
          {!team.members.length ? <li className="text-slate-500">No members.</li> : null}
        </ul>

        <div className="flex gap-2">
          <Select value={newMember} onChange={(event) => setNewMember(event.target.value)}>
            <option value="">Select member</option>
            {allMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} ({member.role})
              </option>
            ))}
          </Select>
          <Button
            onClick={() => {
              if (newMember) onAddMember(team.id, newMember);
            }}
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
