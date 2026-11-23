-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DATA_BREACH', 'PIX_SCAM', 'PHISHING', 'ACCOUNT_TAKEOVER', 'STOLEN_PHONE', 'IDENTITY_FRAUD');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('DETECTED', 'REPORTED');

-- CreateEnum
CREATE TYPE "ClassifiedBy" AS ENUM ('SYSTEM', 'USER', 'AI', 'RULES');

-- AlterTable
ALTER TABLE "Breach" ADD COLUMN     "dpoContact" TEXT;

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "IncidentType" NOT NULL,
    "source" "IncidentSource" NOT NULL,
    "classifiedBy" "ClassifiedBy" NOT NULL,
    "breachId" TEXT,
    "narrative" TEXT,
    "summary" TEXT,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lgpdSentAt" TIMESTAMP(3),
    "lgpdAnsweredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_userId_createdAt_idx" ON "Incident"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_sessionId_idx" ON "Incident"("sessionId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_breachId_fkey" FOREIGN KEY ("breachId") REFERENCES "Breach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
