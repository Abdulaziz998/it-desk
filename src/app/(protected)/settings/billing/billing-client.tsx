"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBillingPortalSession, createCheckoutSession, updateAuditRetentionSetting } from "@/server/actions/billing-actions";

type BillingClientProps = {
  orgName: string;
  planLabel: string;
  planStatus: string;
  stripeConfigured: boolean;
  hasEnterpriseFeatures: boolean;
  auditRetentionDays: number;
};

export function BillingClient({
  orgName,
  planLabel,
  planStatus,
  stripeConfigured,
  hasEnterpriseFeatures,
  auditRetentionDays,
}: BillingClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [retention, setRetention] = useState(String(auditRetentionDays));

  async function redirectToCheckout(plan: "PRO" | "ENTERPRISE") {
    setMessage(null);
    setError(null);
    setBusy(plan);

    const result = await createCheckoutSession({ plan });
    setBusy(null);

    if (!result.ok) {
      setError(result.error ?? "Unable to create checkout session");
      return;
    }

    if (!result.data.url) {
      setError("Unable to create checkout session");
      return;
    }

    window.location.href = result.data.url;
  }

  async function openPortal() {
    setMessage(null);
    setError(null);
    setBusy("portal");

    const result = await createBillingPortalSession();
    setBusy(null);

    if (!result.ok) {
      setError(result.error ?? "Unable to open Stripe billing portal");
      return;
    }

    if (!result.data.url) {
      setError("Unable to open Stripe billing portal");
      return;
    }

    window.location.href = result.data.url;
  }

  async function saveRetention() {
    setMessage(null);
    setError(null);
    setBusy("retention");

    const result = await updateAuditRetentionSetting({ days: Number(retention) });
    setBusy(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage(`Audit log retention updated to ${result.data.auditLogRetentionDays} days.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="font-medium">Organization:</span> {orgName}
          </p>
          <p>
            <span className="font-medium">Current plan:</span> {planLabel}
          </p>
          <p>
            <span className="font-medium">Plan status:</span> {planStatus}
          </p>
          {!stripeConfigured ? <p className="text-amber-700">Stripe env vars are missing. Configure Stripe to enable checkout.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => redirectToCheckout("PRO")} disabled={!stripeConfigured || busy !== null}>
              {busy === "PRO" ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
            <Button variant="outline" onClick={() => redirectToCheckout("ENTERPRISE")} disabled={!stripeConfigured || busy !== null}>
              {busy === "ENTERPRISE" ? "Redirecting..." : "Upgrade to Enterprise"}
            </Button>
            <Button variant="outline" onClick={openPortal} disabled={!stripeConfigured || busy !== null}>
              {busy === "portal" ? "Opening..." : "Manage Billing"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enterprise settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasEnterpriseFeatures ? (
            <>
              <div className="max-w-xs">
                <Label>Audit log retention (days)</Label>
                <Input value={retention} onChange={(event) => setRetention(event.target.value)} />
              </div>
              <Button onClick={saveRetention} disabled={busy !== null}>
                {busy === "retention" ? "Saving..." : "Save retention"}
              </Button>
              <p className="text-sm text-slate-600">Advanced RBAC export is available on the Permissions admin page.</p>
            </>
          ) : (
            <p className="text-sm text-amber-700">Enterprise plan required for audit retention controls and RBAC export.</p>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
    </div>
  );
}
