-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('DISCOVERY', 'EVALUATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "BuyingSignalType" AS ENUM ('BUDGET_CONFIRMED', 'AUTHORITY_IDENTIFIED', 'NEED_EXPRESSED', 'TIMELINE_DEFINED', 'COMPETITOR_MENTION', 'OBJECTION_RAISED', 'PURCHASE_INTENT', 'CHURN_RISK', 'ENGAGEMENT_SPIKE', 'PAIN_POINT', 'POSITIVE_SENTIMENT');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('GEMINI', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "stage" "LeadStage" NOT NULL DEFAULT 'DISCOVERY',
    "score" INTEGER NOT NULL DEFAULT 0,
    "assignedUserId" TEXT,
    "estimatedValue" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'PROSPECTING',
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER NOT NULL DEFAULT 50,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "lostReason" TEXT,
    "assignedUserId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_evidences" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "signalType" "BuyingSignalType" NOT NULL,
    "signalCategory" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "snippet" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isInvalidated" BOOLEAN NOT NULL DEFAULT false,
    "invalidationReason" TEXT,
    "invalidatedByUserId" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "provider" "LlmProvider" NOT NULL DEFAULT 'GEMINI',
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "inputVariables" JSONB NOT NULL DEFAULT '[]',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_workspaceId_status_idx" ON "leads"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "leads_workspaceId_stage_idx" ON "leads"("workspaceId", "stage");

-- CreateIndex
CREATE INDEX "leads_workspaceId_score_idx" ON "leads"("workspaceId", "score");

-- CreateIndex
CREATE INDEX "leads_workspaceId_assignedUserId_idx" ON "leads"("workspaceId", "assignedUserId");

-- CreateIndex
CREATE INDEX "leads_workspaceId_lastActivityAt_idx" ON "leads"("workspaceId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "leads_workspaceId_createdAt_idx" ON "leads"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_workspaceId_contactId_key" ON "leads"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "opportunities_workspaceId_stage_idx" ON "opportunities"("workspaceId", "stage");

-- CreateIndex
CREATE INDEX "opportunities_workspaceId_assignedUserId_idx" ON "opportunities"("workspaceId", "assignedUserId");

-- CreateIndex
CREATE INDEX "opportunities_workspaceId_expectedCloseDate_idx" ON "opportunities"("workspaceId", "expectedCloseDate");

-- CreateIndex
CREATE INDEX "opportunities_workspaceId_leadId_idx" ON "opportunities"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX "opportunities_workspaceId_contactId_idx" ON "opportunities"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "sales_evidences_workspaceId_leadId_idx" ON "sales_evidences"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX "sales_evidences_workspaceId_conversationId_idx" ON "sales_evidences"("workspaceId", "conversationId");

-- CreateIndex
CREATE INDEX "sales_evidences_workspaceId_signalType_idx" ON "sales_evidences"("workspaceId", "signalType");

-- CreateIndex
CREATE INDEX "sales_evidences_workspaceId_isInvalidated_idx" ON "sales_evidences"("workspaceId", "isInvalidated");

-- CreateIndex
CREATE INDEX "sales_evidences_workspaceId_createdAt_idx" ON "sales_evidences"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_templates_workspaceId_isActive_idx" ON "prompt_templates"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "prompt_templates_workspaceId_provider_idx" ON "prompt_templates"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "prompt_templates_workspaceId_isDefault_idx" ON "prompt_templates"("workspaceId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_templates_workspaceId_name_version_key" ON "prompt_templates"("workspaceId", "name", "version");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_evidences" ADD CONSTRAINT "sales_evidences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_evidences" ADD CONSTRAINT "sales_evidences_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_evidences" ADD CONSTRAINT "sales_evidences_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_evidences" ADD CONSTRAINT "sales_evidences_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_evidences" ADD CONSTRAINT "sales_evidences_invalidatedByUserId_fkey" FOREIGN KEY ("invalidatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
