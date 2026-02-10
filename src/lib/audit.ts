import { prisma } from "./db";

export async function writeAuditLog(params: {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      metadata: (params.metadata ?? undefined) as object | undefined,
    },
  });
}
