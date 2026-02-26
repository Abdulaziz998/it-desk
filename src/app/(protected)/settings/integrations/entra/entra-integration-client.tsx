"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testEntraConnection, upsertEntraIntegration } from "@/server/actions/integration-actions";

type EntraIntegrationClientProps = {
  initialValues: {
    enabled: boolean;
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
  isConnected: boolean;
};

export function EntraIntegrationClient({ initialValues, isConnected }: EntraIntegrationClientProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setMessage(null);

    const result = await upsertEntraIntegration(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Entra integration saved.");
    router.refresh();
  };

  const testConnection = async () => {
    setError(null);
    setMessage(null);

    const result = await testEntraConnection({});
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(result.data.message);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Microsoft Entra ID (Mock)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Connection status:{" "}
            <span className={isConnected ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
              {isConnected ? "Connected" : "Not connected"}
            </span>
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
            <span>Enabled</span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Tenant ID</Label>
              <Input value={values.tenantId} onChange={(event) => setValues((current) => ({ ...current, tenantId: event.target.value }))} />
            </div>
            <div>
              <Label>Client ID</Label>
              <Input value={values.clientId} onChange={(event) => setValues((current) => ({ ...current, clientId: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={values.clientSecret}
                onChange={(event) => setValues((current) => ({ ...current, clientSecret: event.target.value }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save}>Save integration</Button>
            <Button variant="outline" onClick={testConnection}>
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  );
}
