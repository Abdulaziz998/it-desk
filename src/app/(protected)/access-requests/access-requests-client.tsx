"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addAccessRequestAttachment,
  createAccessRequest,
  executeAccessRequestInEntra,
  updateAccessRequestStatus,
} from "@/server/actions/access-request-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type AccessRequestRow = {
  id: string;
  requestType: "ADD_USER_TO_GROUP" | "REMOVE_FROM_GROUP" | "RESET_MFA" | "GRANT_APP_ROLE";
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  title: string;
  description: string;
  targetUpn: string | null;
  targetGroupId: string | null;
  appRoleName: string | null;
  requesterName: string;
  assignedToName: string;
  createdAt: Date;
  attachments: Array<{ id: string; filename: string; sizeBytes: number; url: string }>;
};

type AccessRequestsClientProps = {
  requests: AccessRequestRow[];
  approvers: Array<{ userId: string; name: string }>;
  canApprove: boolean;
  canExecuteInEntra: boolean;
  isEntraConfigured: boolean;
};

export function AccessRequestsClient({ requests, approvers, canApprove, canExecuteInEntra, isEntraConfigured }: AccessRequestsClientProps) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<AccessRequestRow["requestType"]>("ADD_USER_TO_GROUP");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetUpn, setTargetUpn] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [appRoleName, setAppRoleName] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    setMessage(null);

    const result = await createAccessRequest({
      requestType,
      title,
      description,
      targetUpn: targetUpn || undefined,
      targetGroupId: targetGroupId || undefined,
      appRoleName: appRoleName || undefined,
      assignedToId: assignedToId || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTitle("");
    setDescription("");
    setTargetUpn("");
    setTargetGroupId("");
    setAppRoleName("");
    setAssignedToId("");
    setMessage("Access request submitted.");
    router.refresh();
  };

  const executeInEntra = async (accessRequestId: string) => {
    setError(null);
    setMessage(null);

    const result = await executeAccessRequestInEntra({ accessRequestId });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(result.data.message);
    router.refresh();
  };

  const setStatus = async (accessRequestId: string, status: AccessRequestRow["status"]) => {
    const result = await updateAccessRequestStatus({ accessRequestId, status });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Request updated to ${status}.`);
    router.refresh();
  };

  const addAttachment = async (accessRequestId: string) => {
    const filename = prompt("Attachment filename", "evidence.txt");
    if (!filename) return;
    const sizeText = prompt("File size in bytes", "1024") ?? "1024";

    const result = await addAccessRequestAttachment({
      accessRequestId,
      filename,
      sizeBytes: Number(sizeText),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Attachment metadata added.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit access request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Request type</Label>
              <Select value={requestType} onChange={(event) => setRequestType(event.target.value as AccessRequestRow["requestType"])}>
                <option value="ADD_USER_TO_GROUP">Add user to group</option>
                <option value="REMOVE_FROM_GROUP">Remove from group</option>
                <option value="RESET_MFA">Reset MFA</option>
                <option value="GRANT_APP_ROLE">Grant app role</option>
              </Select>
            </div>
            <div>
              <Label>Assign to IAM agent</Label>
              <Select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                <option value="">Auto</option>
                {approvers.map((approver) => (
                  <option key={approver.userId} value={approver.userId}>
                    {approver.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Grant Finance app role" />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Business justification, target user, deadline" />
            </div>
            <div>
              <Label>Target UPN</Label>
              <Input value={targetUpn} onChange={(event) => setTargetUpn(event.target.value)} placeholder="user@contoso.com" />
            </div>
            <div>
              <Label>Target group ID</Label>
              <Input value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} placeholder="entra-group-id" />
            </div>
            <div className="md:col-span-2">
              <Label>App role name</Label>
              <Input value={appRoleName} onChange={(event) => setAppRoleName(event.target.value)} placeholder="Finance.Reader" />
            </div>
          </div>

          <Button onClick={create}>Submit request</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {requests.map((request) => (
              <li key={request.id} id={`access-request-${request.id}`} className="rounded border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{request.title}</p>
                    <p className="text-xs text-slate-500">
                      {request.requestType} - by {request.requesterName} - {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === "APPROVED" || request.status === "COMPLETED"
                        ? "success"
                        : request.status === "REJECTED" || request.status === "FAILED"
                          ? "danger"
                          : "info"
                    }
                  >
                    {request.status}
                  </Badge>
                </div>

                <p className="mb-2 text-sm text-slate-700">{request.description}</p>
                <p className="mb-2 text-xs text-slate-500">Assigned to: {request.assignedToName}</p>
                <p className="mb-2 text-xs text-slate-500">
                  Target: {request.targetUpn ?? "n/a"}
                  {request.targetGroupId ? ` | Group: ${request.targetGroupId}` : ""}
                  {request.appRoleName ? ` | App Role: ${request.appRoleName}` : ""}
                </p>

                <div className="mb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Evidence attachments</p>
                  <ul className="text-sm text-slate-700">
                    {request.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.filename} ({attachment.sizeBytes} bytes) - {attachment.url}
                      </li>
                    ))}
                    {!request.attachments.length ? <li className="text-slate-500">No evidence uploaded.</li> : null}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => addAttachment(request.id)}>
                    Add evidence stub
                  </Button>
                  {canApprove ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setStatus(request.id, "APPROVED")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(request.id, "REJECTED")}>
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(request.id, "IN_PROGRESS")}>
                        In progress
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(request.id, "COMPLETED")}>
                        Complete
                      </Button>
                    </>
                  ) : null}
                  {canExecuteInEntra ? (
                    <Button
                      size="sm"
                      onClick={() => executeInEntra(request.id)}
                      disabled={!isEntraConfigured}
                      title={!isEntraConfigured ? "Configure Entra integration first" : "Execute request in mock Entra"}
                    >
                      Execute in Entra
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
            {!requests.length ? <li className="text-sm text-slate-500">No access requests yet.</li> : null}
          </ul>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
