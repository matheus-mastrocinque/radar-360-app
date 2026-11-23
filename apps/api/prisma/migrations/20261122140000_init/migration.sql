-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('EMAIL', 'CPF', 'PHONE');

-- CreateEnum
CREATE TYPE "ScanMode" AS ENUM ('HOME', 'PUBLIC');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "hmac" TEXT NOT NULL,
    "masked" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breach" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "disclosedAt" TIMESTAMP(3),
    "dataClasses" TEXT[],
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Breach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreachRecord" (
    "id" TEXT NOT NULL,
    "breachId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "hmac" TEXT NOT NULL,

    CONSTRAINT "BreachRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exposure" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "breachId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "Exposure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkScan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "ScanMode" NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "hostOs" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "network" JSONB NOT NULL,
    "devices" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkFinding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "deviceIp" TEXT,
    "port" INTEGER,

    CONSTRAINT "NetworkFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_type_hmac_key" ON "Asset"("type", "hmac");

-- CreateIndex
CREATE UNIQUE INDEX "Breach_slug_key" ON "Breach"("slug");

-- CreateIndex
CREATE INDEX "BreachRecord_assetType_hmac_idx" ON "BreachRecord"("assetType", "hmac");

-- CreateIndex
CREATE UNIQUE INDEX "BreachRecord_breachId_assetType_hmac_key" ON "BreachRecord"("breachId", "assetType", "hmac");

-- CreateIndex
CREATE UNIQUE INDEX "Exposure_assetId_breachId_key" ON "Exposure"("assetId", "breachId");

-- CreateIndex
CREATE UNIQUE INDEX "PairingToken_tokenHash_key" ON "PairingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "NetworkScan_userId_createdAt_idx" ON "NetworkScan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NetworkFinding_scanId_idx" ON "NetworkFinding"("scanId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreachRecord" ADD CONSTRAINT "BreachRecord_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "Breach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exposure" ADD CONSTRAINT "Exposure_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exposure" ADD CONSTRAINT "Exposure_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "Breach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingToken" ADD CONSTRAINT "PairingToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkScan" ADD CONSTRAINT "NetworkScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkFinding" ADD CONSTRAINT "NetworkFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "NetworkScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
