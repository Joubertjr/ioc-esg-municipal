-- CreateTable
CREATE TABLE "OdsScore" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "odsNumber" INTEGER NOT NULL,
    "score" INTEGER,
    "status" TEXT,
    "indicatorCount" INTEGER NOT NULL DEFAULT 0,
    "referenceYear" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sources" TEXT[],

    CONSTRAINT "OdsScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OdsScore_municipalityId_odsNumber_referenceYear_key" ON "OdsScore"("municipalityId", "odsNumber", "referenceYear");

-- CreateIndex
CREATE INDEX "OdsScore_municipalityId_referenceYear_idx" ON "OdsScore"("municipalityId", "referenceYear");

-- CreateIndex
CREATE INDEX "OdsScore_odsNumber_idx" ON "OdsScore"("odsNumber");

-- AddForeignKey
ALTER TABLE "OdsScore" ADD CONSTRAINT "OdsScore_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
