import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      orgSlug: string;
      orgName: string;
      role: "OrgAdmin" | "Agent" | "Requester" | "ReadOnly";
      membershipId: string;
    } & DefaultSession["user"];
  }

  interface User {
    orgId: string;
    orgSlug: string;
    orgName: string;
    role: "OrgAdmin" | "Agent" | "Requester" | "ReadOnly";
    membershipId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    role?: string;
    membershipId?: string;
  }
}
