"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TopbarProps = {
  userName?: string | null;
  orgName: string;
  role: string;
};

export function Topbar({ userName, orgName, role }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{orgName}</p>
        <p className="text-xs text-slate-500">Role: {role}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/profile" className="text-sm text-slate-600 hover:text-slate-900">
          {userName ?? "User"}
        </Link>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
