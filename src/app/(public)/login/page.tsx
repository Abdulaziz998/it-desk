import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { LoginForm } from "@/app/(public)/login/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <LoginForm />
      <div className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p>Need access?</p>
        <p>
          Ask your OrgAdmin for an invite link or use the{" "}
          <Link className="font-medium text-sky-700 hover:text-sky-800" href="/reset-password">
            password reset stub
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
