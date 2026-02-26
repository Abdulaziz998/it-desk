"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteSchema } from "@/lib/validation/schemas";
import { acceptInvitation } from "@/server/actions/auth-actions";

const formSchema = acceptInviteSchema;
type FormValues = z.infer<typeof formSchema>;

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setStatus(null);

    const result = await acceptInvitation(token, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setStatus(`Invitation accepted for ${result.data.orgName}. Redirecting to login...`);
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-xs text-rose-600">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && <p className="text-xs text-rose-600">{errors.password.message}</p>}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {status && <p className="text-sm text-emerald-600">{status}</p>}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Accepting..." : "Accept invitation"}
      </Button>
    </form>
  );
}
