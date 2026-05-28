-- HITL queue + agent audit log (MDO fase 2)

CREATE TABLE "HitlRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "municipalityId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "payload" JSONB NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "HitlRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "toolNames" TEXT[],
    "promptHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HitlRequest_status_createdAt_idx" ON "HitlRequest"("status", "createdAt");
CREATE INDEX "HitlRequest_municipalityId_status_idx" ON "HitlRequest"("municipalityId", "status");
CREATE INDEX "AgentAuditLog_municipalityId_createdAt_idx" ON "AgentAuditLog"("municipalityId", "createdAt");
CREATE INDEX "AgentAuditLog_userId_createdAt_idx" ON "AgentAuditLog"("userId", "createdAt");
CREATE INDEX "AgentAuditLog_action_createdAt_idx" ON "AgentAuditLog"("action", "createdAt");

ALTER TABLE "HitlRequest" ADD CONSTRAINT "HitlRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HitlRequest" ADD CONSTRAINT "HitlRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
