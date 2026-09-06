-- CreateEnum
CREATE TYPE "LeadGrade" AS ENUM ('HOT', 'WARM', 'COLD', 'JUNK');

-- CreateEnum
CREATE TYPE "ScoreTriggerEvent" AS ENUM ('INITIAL_CALCULATION', 'MESSAGE_RECEIVED', 'EVIDENCE_DETECTED', 'EVIDENCE_INVALIDATED', 'STAGE_CHANGED', 'MANUAL_RECALCULATION', 'TIME_DECAY');

-- CreateTable
CREATE TABLE "lead_scores" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "grade" "LeadGrade" NOT NULL DEFAULT 'COLD',
    "scoreFactors" JSONB NOT NULL DEFAULT '[]',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_score_histories" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "previousScore" INTEGER NOT NULL,
    "newScore" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL DEFAULT 0,
    "previousGrade" "LeadGrade",
    "newGrade" "LeadGrade",
    "reason" TEXT NOT NULL,
    "eventTrigger" "ScoreTriggerEvent" NOT NULL,
    "scoreFactors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_score_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_scores_leadId_key" ON "lead_scores"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_scores_workspaceId_leadId_key" ON "lead_scores"("workspaceId", "leadId");

-- CreateIndex
CREATE INDEX "lead_scores_workspaceId_grade_idx" ON "lead_scores"("workspaceId", "grade");

-- CreateIndex
CREATE INDEX "lead_scores_workspaceId_score_idx" ON "lead_scores"("workspaceId", "score");

-- CreateIndex
CREATE INDEX "lead_score_histories_workspaceId_leadId_createdAt_idx" ON "lead_score_histories"("workspaceId", "leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_score_histories" ADD CONSTRAINT "lead_score_histories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_score_histories" ADD CONSTRAINT "lead_score_histories_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
