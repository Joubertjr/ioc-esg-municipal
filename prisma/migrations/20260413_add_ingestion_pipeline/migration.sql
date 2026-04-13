-- AlterTable: OdsIndicator — add updatedAt, unique constraint, missing indexes
ALTER TABLE "OdsIndicator" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DELETE FROM "OdsIndicator" a
USING "OdsIndicator" b
WHERE a.id > b.id
  AND a."municipalityId" = b."municipalityId"
  AND a."indicatorName" = b."indicatorName"
  AND a."referenceYear" = b."referenceYear";

CREATE UNIQUE INDEX IF NOT EXISTS "OdsIndicator_municipalityId_indicatorName_referenceYear_key" ON "OdsIndicator"("municipalityId", "indicatorName", "referenceYear");
CREATE INDEX IF NOT EXISTS "OdsIndicator_municipalityId_referenceYear_idx" ON "OdsIndicator"("municipalityId", "referenceYear");
CREATE INDEX IF NOT EXISTS "OdsIndicator_source_referenceYear_idx" ON "OdsIndicator"("source", "referenceYear");

-- AlterTable: OdsScore — add updatedAt + index
ALTER TABLE "OdsScore" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "OdsScore_municipalityId_calculatedAt_idx" ON "OdsScore"("municipalityId", "calculatedAt");

-- CreateTable: IngestionRun
CREATE TABLE IF NOT EXISTS "IngestionRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalMunicipalities" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "indicatorsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "referenceYear" INTEGER,
    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IngestionRun_source_status_completedAt_idx" ON "IngestionRun"("source", "status", "completedAt");
CREATE INDEX IF NOT EXISTS "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
CREATE INDEX IF NOT EXISTS "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");

-- CreateTable: IngestionLog
CREATE TABLE IF NOT EXISTS "IngestionLog" (
    "id" TEXT NOT NULL,
    "ingestionRunId" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "indicatorsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngestionLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngestionLog_ingestionRunId_municipalityId_key" ON "IngestionLog"("ingestionRunId", "municipalityId");
CREATE INDEX IF NOT EXISTS "IngestionLog_ingestionRunId_idx" ON "IngestionLog"("ingestionRunId");
CREATE INDEX IF NOT EXISTS "IngestionLog_municipalityId_createdAt_idx" ON "IngestionLog"("municipalityId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "IngestionLog" ADD CONSTRAINT "IngestionLog_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IngestionLog" ADD CONSTRAINT "IngestionLog_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
