-- AlterEnum
BEGIN;
CREATE TYPE "SenderType_new" AS ENUM ('CONTACT', 'USER', 'SYSTEM');
ALTER TABLE "messages" ALTER COLUMN "senderType" TYPE "SenderType_new" USING ("senderType"::text::"SenderType_new");
ALTER TYPE "SenderType" RENAME TO "SenderType_old";
ALTER TYPE "SenderType_new" RENAME TO "SenderType";
DROP TYPE "public"."SenderType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ai_intelligence" DROP CONSTRAINT IF EXISTS "ai_intelligence_leadId_fkey";
ALTER TABLE "conversation_ai_analyses" DROP CONSTRAINT IF EXISTS "conversation_ai_analyses_conversationId_fkey";
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_contactId_fkey";
ALTER TABLE "copilot_decisions" DROP CONSTRAINT IF EXISTS "copilot_decisions_conversationId_fkey";
ALTER TABLE "copilot_decisions" DROP CONSTRAINT IF EXISTS "copilot_decisions_leadId_fkey";
ALTER TABLE "lead_score_histories" DROP CONSTRAINT IF EXISTS "lead_score_histories_leadId_fkey";
ALTER TABLE "lead_scores" DROP CONSTRAINT IF EXISTS "lead_scores_leadId_fkey";
ALTER TABLE "lead_stage_histories" DROP CONSTRAINT IF EXISTS "lead_stage_histories_changedById_fkey";
ALTER TABLE "lead_stage_histories" DROP CONSTRAINT IF EXISTS "lead_stage_histories_leadId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assigneeId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_contactId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_primaryConversationId_fkey";
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_workspaceId_fkey";
ALTER TABLE "sales_evidences" DROP CONSTRAINT IF EXISTS "sales_evidences_leadId_fkey";
ALTER TABLE "tool_execution_records" DROP CONSTRAINT IF EXISTS "tool_execution_records_decisionId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "contacts_workspaceId_identifier_idx";

-- AlterTable
ALTER TABLE "channel_identities" DROP COLUMN IF EXISTS "channelType";
ALTER TABLE "messages" ALTER COLUMN "senderId" DROP NOT NULL,
ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "aiAutonomyLevel";

-- DropTable
DROP TABLE IF EXISTS "ai_intelligence" CASCADE;
DROP TABLE IF EXISTS "conversation_ai_analyses" CASCADE;
DROP TABLE IF EXISTS "copilot_decisions" CASCADE;
DROP TABLE IF EXISTS "lead_score_histories" CASCADE;
DROP TABLE IF EXISTS "lead_scores" CASCADE;
DROP TABLE IF EXISTS "lead_stage_histories" CASCADE;
DROP TABLE IF EXISTS "leads" CASCADE;
DROP TABLE IF EXISTS "sales_evidences" CASCADE;
DROP TABLE IF EXISTS "tool_execution_records" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "AIAutonomyLevel";
DROP TYPE IF EXISTS "DecisionStatus";
DROP TYPE IF EXISTS "EvidenceSourceType";
DROP TYPE IF EXISTS "ExecutionStatus";
DROP TYPE IF EXISTS "LeadLifecycleStage";
DROP TYPE IF EXISTS "PolicyResult";
DROP TYPE IF EXISTS "SentimentType";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspaceId_identifier_key" ON "contacts"("workspaceId", "identifier");
CREATE INDEX IF NOT EXISTS "conversations_workspaceId_teamId_idx" ON "conversations"("workspaceId", "teamId");
CREATE INDEX IF NOT EXISTS "inbox_members_userId_idx" ON "inbox_members"("userId");
CREATE INDEX IF NOT EXISTS "messages_workspaceId_senderType_senderId_idx" ON "messages"("workspaceId", "senderType", "senderId");
CREATE INDEX IF NOT EXISTS "team_members_userId_idx" ON "team_members"("userId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
