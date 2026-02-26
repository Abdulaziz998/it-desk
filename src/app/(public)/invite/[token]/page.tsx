import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "@/app/(public)/invite/[token]/accept-invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation) {
    notFound();
  }

  const expired = invitation.expiresAt < new Date();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join {invitation.organization.name}</CardTitle>
        <CardDescription>{invitation.email}</CardDescription>
      </CardHeader>
      <CardContent>
        {expired || invitation.acceptedAt ? (
          <p className="text-sm text-rose-600">This invitation is no longer valid.</p>
        ) : (
          <AcceptInviteForm token={token} />
        )}
      </CardContent>
    </Card>
  );
}
