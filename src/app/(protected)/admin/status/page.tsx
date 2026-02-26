import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SystemStatusPage() {
  await requirePagePermission("settings.manage");

  let dbStatus = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "down";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Application: up</p>
          <p>Database: {dbStatus}</p>
          <p>Health endpoint: /api/health</p>
          <p>Checked at: {new Date().toISOString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
