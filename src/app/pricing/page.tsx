import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["Tickets", "Users", "Knowledge Base"],
  },
  {
    name: "Pro",
    price: "Stripe subscription",
    features: ["Everything in Free", "Background jobs", "Entra integration"],
  },
  {
    name: "Enterprise",
    price: "Stripe subscription",
    features: ["Everything in Pro", "Audit retention controls", "Advanced RBAC export"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">IT OpsDesk Pricing</h1>
        <p className="text-slate-600">Choose a plan and manage subscription from the Billing settings page.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium text-slate-800">{plan.price}</p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-2">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings/billing">Manage billing</Link>
        </Button>
      </div>
    </div>
  );
}
