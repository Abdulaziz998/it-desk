"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  Users,
  ShieldCheck,
  BookOpen,
  Settings,
  UserCircle,
  Bell,
  Laptop,
  Workflow,
  Activity,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/users", label: "Users", icon: Users },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/access-requests", label: "Access Requests", icon: ShieldCheck },
  { href: "/assets", label: "Assets", icon: Laptop },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/integrations/entra", label: "Entra Integration", icon: ShieldCheck },
  { href: "/admin/status", label: "System Status", icon: Activity },
  { href: "/admin/metrics", label: "Metrics", icon: Activity },
  { href: "/admin/audit", label: "Audit Logs", icon: Activity },
  { href: "/admin/integrations/logs", label: "Integration Logs", icon: Activity },
  { href: "/admin/permissions", label: "Permissions", icon: Activity },
  { href: "/admin/jobs", label: "Jobs", icon: Activity },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-r border-slate-200 bg-white md:w-64">
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">IT OpsDesk</p>
          <p className="text-xs text-slate-500">Multi-tenant Service Desk</p>
        </div>
      </div>
      <nav className="grid grid-cols-2 gap-1 p-2 md:grid-cols-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900",
                isActive && "bg-slate-100 font-medium text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
