import { Role } from "@prisma/client";
import { requirePagePermission } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roleOrder: Role[] = ["OrgAdmin", "Agent", "Requester", "ReadOnly"];

export default async function PermissionsMatrixPage() {
  await requirePagePermission("users.manage");

  const permissions = await prisma.permission.findMany({
    include: {
      rolePermissions: true,
    },
    orderBy: {
      key: "asc",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role-Permission Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-3 py-2">Permission</th>
                <th className="px-3 py-2">Description</th>
                {roleOrder.map((role) => (
                  <th key={role} className="px-3 py-2 text-center">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => {
                const roleSet = new Set(permission.rolePermissions.map((item) => item.role));
                return (
                  <tr key={permission.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{permission.key}</td>
                    <td className="px-3 py-2 text-slate-600">{permission.description}</td>
                    {roleOrder.map((role) => (
                      <td key={`${permission.id}-${role}`} className="px-3 py-2 text-center text-lg">
                        {roleSet.has(role) ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">-</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!permissions.length ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    No permissions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
