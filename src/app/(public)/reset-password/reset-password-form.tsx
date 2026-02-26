"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendPasswordResetStub } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordResetStubSchema } from "@/lib/validation/schemas";

const formSchema = passwordResetStubSchema;
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setMessage(null);
    setError(null);

    const result = await sendPasswordResetStub(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMessage("If this email exists, a reset stub has been queued.");
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Send reset link (stub)"}
      </Button>
    </form>
  );
}
