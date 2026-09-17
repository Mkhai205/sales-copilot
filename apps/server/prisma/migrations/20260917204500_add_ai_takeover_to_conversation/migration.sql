-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "isAiPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN "lastAiMessageAt" TIMESTAMP(3);
