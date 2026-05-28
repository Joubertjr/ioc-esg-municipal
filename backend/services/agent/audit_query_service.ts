import { prisma } from "../../lib/prisma.js";

export interface AuditLogDto {
  id: string;
  userId: string;
  municipalityId: string;
  action: string;
  toolNames: string[];
  promptHash: string | null;
  createdAt: string;
}

export async function listAgentAuditLogs(params: {
  municipalityId?: string;
  limit?: number;
}): Promise<AuditLogDto[]> {
  const limit = Math.min(params.limit ?? 50, 100);

  const rows = await prisma.agentAuditLog.findMany({
    where: params.municipalityId ? { municipalityId: params.municipalityId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    municipalityId: r.municipalityId,
    action: r.action,
    toolNames: r.toolNames,
    promptHash: r.promptHash,
    createdAt: r.createdAt.toISOString(),
  }));
}
