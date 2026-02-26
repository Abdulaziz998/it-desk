import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/app/(public)/reset-password/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Password reset (stub)</CardTitle>
          <CardDescription>This queues a reset email entry for the MVP.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
      <Link href="/login" className="block text-center text-sm text-sky-700 hover:text-sky-800">
        Back to login
      </Link>
    </div>
  );
}
