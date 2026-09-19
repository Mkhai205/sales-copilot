-- =============================================================================
-- Phase 3A: Cleanup & Stabilization Migration
-- =============================================================================

-- 1. Pre-migration: Migrate any existing VIEWER role to AGENT before altering enum
UPDATE "workspace_members" SET "role" = 'AGENT' WHERE "role"::text = 'VIEWER';

-- 2. AlterEnum: Remove VIEWER from WorkspaceRole
BEGIN;
CREATE TYPE "WorkspaceRole_new" AS ENUM ('OWNER', 'ADMIN', 'AGENT');
ALTER TABLE "public"."workspace_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "workspace_members" ALTER COLUMN "role" TYPE "WorkspaceRole_new" USING ("role"::text::"WorkspaceRole_new");
ALTER TYPE "WorkspaceRole" RENAME TO "WorkspaceRole_old";
ALTER TYPE "WorkspaceRole_new" RENAME TO "WorkspaceRole";
DROP TYPE "public"."WorkspaceRole_old";
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'AGENT';
COMMIT;

-- 3. Drop Foreign Keys for deleted tables
ALTER TABLE "automation_rules" DROP CONSTRAINT IF EXISTS "automation_rules_workspaceId_fkey";
ALTER TABLE "shipping_addresses" DROP CONSTRAINT IF EXISTS "shipping_addresses_contactId_fkey";
ALTER TABLE "shipping_addresses" DROP CONSTRAINT IF EXISTS "shipping_addresses_orderId_fkey";
ALTER TABLE "shipping_addresses" DROP CONSTRAINT IF EXISTS "shipping_addresses_workspaceId_fkey";
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT IF EXISTS "webhook_deliveries_subscriptionId_fkey";
ALTER TABLE "webhook_subscriptions" DROP CONSTRAINT IF EXISTS "webhook_subscriptions_workspaceId_fkey";

-- 4. AlterTable: Add recipient fields to orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "recipientAddress" TEXT,
ADD COLUMN IF NOT EXISTS "recipientDistrict" TEXT,
ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT,
ADD COLUMN IF NOT EXISTS "recipientProvince" TEXT,
ADD COLUMN IF NOT EXISTS "recipientWard" TEXT,
ADD COLUMN IF NOT EXISTS "shippingNotes" TEXT;

-- 5. Data Migration: Copy recipient info from shipping_addresses to orders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipping_addresses') THEN
    UPDATE "orders" o
    SET
      "recipientName" = sa."recipientName",
      "recipientPhone" = sa."phoneNumber",
      "recipientAddress" = sa."streetAddress",
      "recipientWard" = sa."ward",
      "recipientDistrict" = sa."district",
      "recipientProvince" = sa."province",
      "shippingNotes" = sa."shippingNotes"
    FROM "shipping_addresses" sa
    WHERE o."id" = sa."orderId";
  END IF;
END $$;

-- 6. Drop Tables
DROP TABLE IF EXISTS "automation_rules";
DROP TABLE IF EXISTS "shipping_addresses";
DROP TABLE IF EXISTS "webhook_deliveries";
DROP TABLE IF EXISTS "webhook_subscriptions";

-- 7. Drop Enums
DROP TYPE IF EXISTS "CarrierProvider";
DROP TYPE IF EXISTS "WebhookDeliveryStatus";

-- 8. Create Compound Unique Indices (workspaceId, id) for 10 non-commerce models
CREATE UNIQUE INDEX IF NOT EXISTS "canned_responses_workspaceId_id_key" ON "canned_responses"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "channel_identities_workspaceId_id_key" ON "channel_identities"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "channels_workspaceId_id_key" ON "channels"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspaceId_id_key" ON "contacts"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_workspaceId_id_key" ON "conversations"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "inboxes_workspaceId_id_key" ON "inboxes"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "labels_workspaceId_id_key" ON "labels"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_workspaceId_id_key" ON "messages"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "teams_workspaceId_id_key" ON "teams"("workspaceId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspaceId_id_key" ON "workspace_members"("workspaceId", "id");

-- 9. Partial Unique Index for Facebook Page ID cross-tenant protection (TASK-3A-10)
CREATE UNIQUE INDEX IF NOT EXISTS "channels_facebook_page_unique" ON "channels"("providerAccountId")
WHERE "channelType" = 'FACEBOOK_MESSENGER' AND "providerAccountId" IS NOT NULL;
