-- CreateTable
CREATE TABLE "Municipality" (
    "id" TEXT NOT NULL,
    "ibgeCode" TEXT NOT NULL,
    "siconfiCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SC',
    "population" INTEGER,
    "fpmAnnual" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Municipality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OdsIndicator" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "odsNumber" INTEGER NOT NULL,
    "indicatorName" TEXT NOT NULL,
    "value" DECIMAL(12,4),
    "score" INTEGER,
    "status" TEXT,
    "source" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "dataAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OdsIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "scenarioName" TEXT NOT NULL,
    "investmentAmount" DECIMAL(15,2) NOT NULL,
    "investmentType" TEXT NOT NULL,
    "targetOds" INTEGER[],
    "projectedImpact" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "municipalityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_ibgeCode_key" ON "Municipality"("ibgeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_siconfiCode_key" ON "Municipality"("siconfiCode");

-- CreateIndex
CREATE INDEX "Municipality_state_idx" ON "Municipality"("state");

-- CreateIndex
CREATE INDEX "Municipality_deletedAt_idx" ON "Municipality"("deletedAt");

-- CreateIndex
CREATE INDEX "OdsIndicator_municipalityId_odsNumber_idx" ON "OdsIndicator"("municipalityId", "odsNumber");

-- CreateIndex
CREATE INDEX "OdsIndicator_referenceDate_idx" ON "OdsIndicator"("referenceDate");

-- CreateIndex
CREATE INDEX "Simulation_municipalityId_idx" ON "Simulation"("municipalityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_municipalityId_idx" ON "User"("municipalityId");

-- AddForeignKey
ALTER TABLE "OdsIndicator" ADD CONSTRAINT "OdsIndicator_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simulation" ADD CONSTRAINT "Simulation_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
