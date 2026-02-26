"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileClient({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [nextName, setNextName] = useState(name);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const result = await updateProfile({ name: nextName });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("Profile updated.");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div>
            <Label>Name</Label>
            <Input value={nextName} onChange={(event) => setNextName(event.target.value)} />
          </div>
          <Button onClick={save}>Save profile</Button>
          <p className="text-sm text-slate-600">
            Password reset is currently a stub. Use{" "}
            <Link href="/reset-password" className="text-sky-700 hover:text-sky-800">
              reset password
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
