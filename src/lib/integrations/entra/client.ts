import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export type EntraUser = {
  upn: string;
  displayName: string;
  id: string;
  accountEnabled: boolean;
};

export interface EntraClient {
  getUser(upn: string): Promise<EntraUser>;
  addUserToGroup(upn: string, groupId: string): Promise<void>;
  removeUserFromGroup(upn: string, groupId: string): Promise<void>;
  resetMfa(upn: string): Promise<void>;
}

type MockEntraClientInput = {
  orgId: string;
  actorUserId?: string;
  accessRequestId?: string;
};

type ActionLogInput = {
  action: string;
  targetUpn?: string;
  targetGroupId?: string;
  status: "SUCCESS" | "FAILED";
  message: string;
};

export class MockEntraClient implements EntraClient {
  private readonly orgId: string;
  private readonly actorUserId?: string;
  private readonly accessRequestId?: string;

  constructor(input: MockEntraClientInput) {
    this.orgId = input.orgId;
    this.actorUserId = input.actorUserId;
    this.accessRequestId = input.accessRequestId;
  }

  private shouldFail(upn: string) {
    return upn.toLowerCase().includes("fail");
  }

  private async writeLog(input: ActionLogInput) {
    await prisma.integrationActionLog.create({
      data: {
        orgId: this.orgId,
        provider: "entra",
        action: input.action,
        targetUpn: input.targetUpn,
        targetGroupId: input.targetGroupId,
        accessRequestId: this.accessRequestId,
        status: input.status,
        message: input.message,
      },
    });

    await recordAuditLog({
      orgId: this.orgId,
      actorUserId: this.actorUserId,
      action: `ENTRA_${input.action.toUpperCase()}_${input.status}`,
      entityType: "EntraIntegration",
      entityId: this.accessRequestId,
      metadata: {
        provider: "entra",
        targetUpn: input.targetUpn,
        targetGroupId: input.targetGroupId,
        message: input.message,
      },
    });
  }

  async getUser(upn: string): Promise<EntraUser> {
    const failed = this.shouldFail(upn);
    if (failed) {
      const message = `Mock Entra lookup failed for ${upn}`;
      await this.writeLog({
        action: "getUser",
        targetUpn: upn,
        status: "FAILED",
        message,
      });
      throw new Error(message);
    }

    await this.writeLog({
      action: "getUser",
      targetUpn: upn,
      status: "SUCCESS",
      message: `Mock user lookup succeeded for ${upn}`,
    });

    return {
      upn,
      displayName: upn.split("@")[0].replace(/[._-]/g, " "),
      id: `mock-${upn.toLowerCase()}`,
      accountEnabled: true,
    };
  }

  async addUserToGroup(upn: string, groupId: string): Promise<void> {
    const failed = this.shouldFail(upn);
    const message = failed ? `Mock add user to group failed for ${upn}` : `Mock add user to group succeeded for ${upn}`;

    await this.writeLog({
      action: "addUserToGroup",
      targetUpn: upn,
      targetGroupId: groupId,
      status: failed ? "FAILED" : "SUCCESS",
      message,
    });

    if (failed) {
      throw new Error(message);
    }
  }

  async removeUserFromGroup(upn: string, groupId: string): Promise<void> {
    const failed = this.shouldFail(upn);
    const message = failed
      ? `Mock remove user from group failed for ${upn}`
      : `Mock remove user from group succeeded for ${upn}`;

    await this.writeLog({
      action: "removeUserFromGroup",
      targetUpn: upn,
      targetGroupId: groupId,
      status: failed ? "FAILED" : "SUCCESS",
      message,
    });

    if (failed) {
      throw new Error(message);
    }
  }

  async resetMfa(upn: string): Promise<void> {
    const failed = this.shouldFail(upn);
    const message = failed ? `Mock reset MFA failed for ${upn}` : `Mock reset MFA succeeded for ${upn}`;

    await this.writeLog({
      action: "resetMfa",
      targetUpn: upn,
      status: failed ? "FAILED" : "SUCCESS",
      message,
    });

    if (failed) {
      throw new Error(message);
    }
  }
}

export function createMockEntraClient(input: MockEntraClientInput): EntraClient {
  return new MockEntraClient(input);
}
