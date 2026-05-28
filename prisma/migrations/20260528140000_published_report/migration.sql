-- Relatório executivo publicado (G-HITL-IOC-02)

CREATE TABLE "PublishedExecutiveReport" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "ibgeCode" TEXT NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "institutionStamp" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "hitlRequestId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedExecutiveReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublishedExecutiveReport_municipalityId_publishedAt_idx" ON "PublishedExecutiveReport"("municipalityId", "publishedAt");
CREATE INDEX "PublishedExecutiveReport_ibgeCode_publishedAt_idx" ON "PublishedExecutiveReport"("ibgeCode", "publishedAt");

ALTER TABLE "PublishedExecutiveReport" ADD CONSTRAINT "PublishedExecutiveReport_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
