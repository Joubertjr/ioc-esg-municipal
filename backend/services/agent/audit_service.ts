import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import type { AuditLogEntry } from "./schemas.js";

export interface AppendAuditInput {
  userId: string;
  municipalityId: string;
  action: AuditLogEntry["action"];
  toolNames: string[];
  promptText?: string;
  metadata?: Record<string, unknown>;
}

export function hashPrompt(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Append-only; falhas não bloqueiam a operação principal. */
export async function appendAgentAudit(input: AppendAuditInput): Promise<void> {
  try {
    await prisma.agentAuditLog.create({
      data: {
        userId: input.userId,
        municipalityId: input.municipalityId,
        action: input.action,
        toolNames: input.toolNames.slice(0, 6),
        promptHash: input.promptText ? hashPrompt(input.promptText) : null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    logger.warn("[audit] falha ao gravar trilha agêntica (non-fatal)", {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
