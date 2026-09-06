-- CreateEnum
CREATE TYPE "CopilotSuggestionType" AS ENUM ('REPLY_DRAFT', 'NEXT_BEST_ACTION', 'BATTLECARD');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'APPLIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "copilot_suggestions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "leadId" TEXT,
    "suggestionType" "CopilotSuggestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionPayload" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "dismissedReason" TEXT,
    "resolvedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_suggestions_workspaceId_conversationId_status_idx" ON "copilot_suggestions"("workspaceId", "conversationId", "status");

-- CreateIndex
CREATE INDEX "copilot_suggestions_workspaceId_status_expiresAt_idx" ON "copilot_suggestions"("workspaceId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "copilot_suggestions_workspaceId_leadId_idx" ON "copilot_suggestions"("workspaceId", "leadId");

-- CreateIndex (Partial Unique Index for BR-2.5.1: Single Active Pending Suggestion per Type)
CREATE UNIQUE INDEX "unique_active_pending_copilot_suggestion" ON "copilot_suggestions"("workspaceId", "conversationId", "suggestionType") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "copilot_suggestions" ADD CONSTRAINT "copilot_suggestions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_suggestions" ADD CONSTRAINT "copilot_suggestions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_suggestions" ADD CONSTRAINT "copilot_suggestions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_suggestions" ADD CONSTRAINT "copilot_suggestions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_suggestions" ADD CONSTRAINT "copilot_suggestions_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
