"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAsset, deleteAsset, updateAsset } from "@/server/actions/asset-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AssetRow = {
  id: string;
  assetTag: string;
  type: "LAPTOP" | "SERVER" | "SAAS_APP" | "LICENSE";
  name: string;
  assignedToId: string | null;
  status: "IN_STOCK" | "ASSIGNED" | "RETIRED" | "LOST";
  purchaseDate: Date | null;
  notes: string | null;
};

type AssetsClientProps = {
  assets: AssetRow[];
  users: Array<{ id: string; name: string }>;
};

export function AssetsClient({ assets, users }: AssetsClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newAsset, setNewAsset] = useState({
    assetTag: "",
    type: "LAPTOP" as AssetRow["type"],
    name: "",
    assignedToId: "",
    status: "IN_STOCK" as AssetRow["status"],
    purchaseDate: "",
    notes: "",
  });

  const create = async () => {
    setError(null);
    const result = await createAsset({
      ...newAsset,
      assignedToId: newAsset.assignedToId || undefined,
      purchaseDate: newAsset.purchaseDate || undefined,
      notes: newAsset.notes || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Asset created.");
    setNewAsset({
      assetTag: "",
      type: "LAPTOP",
      name: "",
      assignedToId: "",
      status: "IN_STOCK",
      purchaseDate: "",
      notes: "",
    });
    router.refresh();
  };

  const save = async (asset: AssetRow) => {
    const result = await updateAsset({
      assetId: asset.id,
      assetTag: asset.assetTag,
      type: asset.type,
      name: asset.name,
      assignedToId: asset.assignedToId || undefined,
      status: asset.status,
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : undefined,
      notes: asset.notes || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Asset updated.");
    router.refresh();
  };

  const remove = async (assetId: string) => {
    const result = await deleteAsset({ assetId });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Asset removed.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create asset</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Asset tag" value={newAsset.assetTag} onChange={(event) => setNewAsset((state) => ({ ...state, assetTag: event.target.value }))} />
          <Input placeholder="Asset name" value={newAsset.name} onChange={(event) => setNewAsset((state) => ({ ...state, name: event.target.value }))} />
          <Select value={newAsset.type} onChange={(event) => setNewAsset((state) => ({ ...state, type: event.target.value as AssetRow["type"] }))}>
            <option value="LAPTOP">Laptop</option>
            <option value="SERVER">Server</option>
            <option value="SAAS_APP">SaaS App</option>
            <option value="LICENSE">License</option>
          </Select>
          <Select value={newAsset.status} onChange={(event) => setNewAsset((state) => ({ ...state, status: event.target.value as AssetRow["status"] }))}>
            <option value="IN_STOCK">In stock</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RETIRED">Retired</option>
            <option value="LOST">Lost</option>
          </Select>
          <Select value={newAsset.assignedToId} onChange={(event) => setNewAsset((state) => ({ ...state, assignedToId: event.target.value }))}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={newAsset.purchaseDate} onChange={(event) => setNewAsset((state) => ({ ...state, purchaseDate: event.target.value }))} />
          <div className="md:col-span-3">
            <Textarea value={newAsset.notes} onChange={(event) => setNewAsset((state) => ({ ...state, notes: event.target.value }))} placeholder="Notes" />
          </div>
          <div className="md:col-span-3">
            <Button onClick={create}>Create asset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} users={users} onSave={save} onRemove={remove} />
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}

function AssetCard({
  asset,
  users,
  onSave,
  onRemove,
}: {
  asset: AssetRow;
  users: Array<{ id: string; name: string }>;
  onSave: (asset: AssetRow) => Promise<void>;
  onRemove: (assetId: string) => Promise<void>;
}) {
  const [state, setState] = useState(asset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{state.assetTag}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <Label>Name</Label>
          <Input value={state.name} onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))} />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label>Type</Label>
            <Select value={state.type} onChange={(event) => setState((current) => ({ ...current, type: event.target.value as AssetRow["type"] }))}>
              <option value="LAPTOP">Laptop</option>
              <option value="SERVER">Server</option>
              <option value="SAAS_APP">SaaS App</option>
              <option value="LICENSE">License</option>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={state.status} onChange={(event) => setState((current) => ({ ...current, status: event.target.value as AssetRow["status"] }))}>
              <option value="IN_STOCK">In stock</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="RETIRED">Retired</option>
              <option value="LOST">Lost</option>
            </Select>
          </div>

          <div>
            <Label>Assigned to</Label>
            <Select
              value={state.assignedToId ?? ""}
              onChange={(event) => setState((current) => ({ ...current, assignedToId: event.target.value || null }))}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Purchase date</Label>
            <Input
              type="date"
              value={state.purchaseDate ? new Date(state.purchaseDate).toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  purchaseDate: event.target.value ? new Date(event.target.value) : null,
                }))
              }
            />
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea value={state.notes ?? ""} onChange={(event) => setState((current) => ({ ...current, notes: event.target.value }))} />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onSave(state)}>Save</Button>
          <Button variant="destructive" onClick={() => onRemove(state.id)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
