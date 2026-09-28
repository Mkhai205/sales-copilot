-- M4.4 remediation: schema hardening (docs/audit/phase-4-m4.3-schema-report.md)
-- HNSW ANN index for pgvector similarity search. Not expressible in the Prisma schema
-- (Prisma has no hnsw DSL); the cosine operator matches knowledge.service searchSimilar
-- (embedding <=> $vector with vector_cosine_ops). Partial index: rows without an
-- embedding can never participate in a similarity search.
CREATE INDEX IF NOT EXISTS "knowledge_article_embedding_hnsw_idx"
  ON "KnowledgeArticle" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

-- DropIndex
DROP INDEX "orders_workspaceId_paymentMethod_idx";

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_action_idx" ON "audit_logs"("workspaceId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "inboxes_workspaceId_name_key" ON "inboxes"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "orders_workspaceId_fulfillmentStatus_idx" ON "orders"("workspaceId", "fulfillmentStatus");

