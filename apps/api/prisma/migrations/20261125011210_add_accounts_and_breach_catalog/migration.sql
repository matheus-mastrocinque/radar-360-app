-- CreateEnum
CREATE TYPE "BreachSource" AS ENUM ('SYNTHETIC', 'HIBP');

-- AlterTable
ALTER TABLE "Breach" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "pwnCount" INTEGER,
ADD COLUMN     "source" "BreachSource" NOT NULL DEFAULT 'SYNTHETIC';

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "reportedCompany" TEXT,
ADD COLUMN     "reportedDataClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reportedOccurredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrackedService" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "isFinancial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedService_userId_domain_idx" ON "TrackedService"("userId", "domain");

-- CreateIndex
CREATE INDEX "TrackedService_sessionId_idx" ON "TrackedService"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Breach_externalId_key" ON "Breach"("externalId");

-- CreateIndex
CREATE INDEX "Breach_domain_idx" ON "Breach"("domain");

-- AddForeignKey
ALTER TABLE "TrackedService" ADD CONSTRAINT "TrackedService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedService" ADD CONSTRAINT "TrackedService_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

