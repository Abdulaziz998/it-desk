"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { loginSchema } from "@/lib/validation/schemas";
import { lookupOrganizationsForLogin } from "@/server/actions/auth-actions";

const formSchema = loginSchema;
type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [orgOptions, setOrgOptions] = useState<Array<{ slug: string; name: string }>>([]);
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      orgSlug: "",
    },
  });

  const email = watch("email");
  const shouldShowOrgPicker = useMemo(() => orgOptions.length > 1, [orgOptions.length]);

  const handleLookupOrgs = () => {
    setError(null);
    setLookupStatus(null);

    startTransition(async () => {
      const result = await lookupOrganizationsForLogin(email);

      if (!result.ok) {
        setLookupStatus(result.error);
        setOrgOptions([]);
        return;
      }

      const organizations = result.data.organizations;
      setOrgOptions(organizations);

      if (organizations.length === 1) {
        setValue("orgSlug", organizations[0].slug);
        setLookupStatus(`Using organization: ${organizations[0].name}`);
      } else if (organizations.length > 1) {
        setLookupStatus("Select your organization before signing in.");
      } else {
        setLookupStatus("No organization memberships found for this email yet.");
      }
    });
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);

    const response = await signIn("credentials", {
      email: values.email,
      password: values.password,
      orgSlug: values.orgSlug,
      redirect: false,
    });

    if (!response || response.error) {
      setError("Login failed. Verify credentials and organization selection.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your organization workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="agent@acme.local" {...register("email")} />
            {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register("password")} />
            {errors.password && <p className="text-xs text-rose-600">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="orgSlug">Organization</Label>
              <Button type="button" size="sm" variant="secondary" onClick={handleLookupOrgs} disabled={isPending}>
                {isPending ? "Checking..." : "Find orgs"}
              </Button>
            </div>
            {shouldShowOrgPicker ? (
              <Select id="orgSlug" {...register("orgSlug")}>
                <option value="">Select organization</option>
                {orgOptions.map((org) => (
                  <option key={org.slug} value={org.slug}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="orgSlug" placeholder="acme-it" {...register("orgSlug")} />
            )}
            {lookupStatus && <p className="text-xs text-slate-600">{lookupStatus}</p>}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
