-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('SINGLE', 'INSTALLMENT', 'FIXED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "frequency" "RecurrenceFrequency",
ADD COLUMN     "groupId" UUID,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "installmentTotal" INTEGER,
ADD COLUMN     "recurrence" "RecurrenceType" NOT NULL DEFAULT 'SINGLE';

-- CreateIndex
CREATE INDEX "Transaction_groupId_idx" ON "Transaction"("groupId");
