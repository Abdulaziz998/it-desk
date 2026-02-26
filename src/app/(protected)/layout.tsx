import { AppSidebar } from "@/components/app/app-sidebar";
import { Topbar } from "@/components/app/topbar";
import { requirePageAuthContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await requirePageAuthContext();

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      <div className="md:fixed md:inset-y-0 md:left-0 md:w-64">
        <AppSidebar />
      </div>
      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <Topbar userName={user?.name} orgName={context.orgName} role={context.role} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
