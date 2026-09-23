-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "embedding" vector(768),
    "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'PENDING',
    "embeddingError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_workspaceId_id_key" ON "KnowledgeArticle"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_idx" ON "KnowledgeArticle"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_isActive_idx" ON "KnowledgeArticle"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_embedding_hnsw_idx" ON "KnowledgeArticle" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
