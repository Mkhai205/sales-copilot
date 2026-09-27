-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "BillingPlanType" AS ENUM ('FREE', 'STANDARD', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('FACEBOOK_MESSENGER', 'ZALO', 'TELEGRAM', 'EMAIL', 'WEB_CHAT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'RESOLVED', 'PENDING', 'SNOOZED');

-- CreateEnum
CREATE TYPE "ConversationPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('INCOMING', 'OUTGOING', 'ACTIVITY', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "MessageContentType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CONTACT', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'FILE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'SHIPPING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VIETQR', 'BANK_TRANSFER', 'COD', 'CASH', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('SEPAY', 'CASSO', 'MANUAL', 'VNPAY', 'MOMO');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'RESERVATION', 'RELEASE_RESERVATION', 'COMMIT_SALE', 'RETURN_RESTOCK', 'INVENTORY_AUDIT');

-- CreateEnum
CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "PlatformRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "billingPlan" "BillingPlanType" NOT NULL DEFAULT 'FREE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'vi',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "avatarUrl" TEXT,
    "identifier" TEXT,
    "customAttributes" JSONB NOT NULL DEFAULT '{}',
    "additionalAttributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_identities" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalContactId" TEXT NOT NULL,
    "username" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inboxes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isAutoAssignmentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_members" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "providerAccountId" TEXT,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_events" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "displayId" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channelIdentityId" TEXT,
    "assigneeId" TEXT,
    "teamId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ConversationPriority" NOT NULL DEFAULT 'MEDIUM',
    "snoozedUntil" TIMESTAMP(3),
    "waitingSince" TIMESTAMP(3),
    "firstReplyCreatedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "customAttributes" JSONB NOT NULL DEFAULT '{}',
    "isAiPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastAiMessageAt" TIMESTAMP(3),
    "lastContactMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_labels" (
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_labels_pkey" PRIMARY KEY ("conversationId","labelId")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT,
    "messageType" "MessageType" NOT NULL DEFAULT 'INCOMING',
    "contentType" "MessageContentType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "externalId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "showOnSidebar" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "basePrice" DECIMAL(15,2) NOT NULL,
    "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "displayId" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'COD',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discountType" "DiscountType" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "discountReason" TEXT,
    "shippingFee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "cancelReason" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientAddress" TEXT,
    "recipientWard" TEXT,
    "recipientDistrict" TEXT,
    "recipientProvince" TEXT,
    "shippingNotes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(15,2) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'VIETQR',
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'MANUAL',
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "transactionCode" TEXT,
    "accountNumber" TEXT,
    "bankCode" TEXT,
    "transferContent" TEXT,
    "qrUrl" TEXT,
    "rawWebhookPayload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "previousReserved" INTEGER NOT NULL,
    "newReserved" INTEGER NOT NULL,
    "reason" TEXT,
    "performedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_isSuspended_idx" ON "workspaces"("isSuspended");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_id_key" ON "workspace_members"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_workspaceId_id_key" ON "teams"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_workspaceId_name_key" ON "teams"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_email_idx" ON "contacts"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_phoneNumber_idx" ON "contacts"("workspaceId", "phoneNumber");

-- CreateIndex
CREATE INDEX "contacts_workspaceId_createdAt_idx" ON "contacts"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_workspaceId_id_key" ON "contacts"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_workspaceId_identifier_key" ON "contacts"("workspaceId", "identifier");

-- CreateIndex
CREATE INDEX "channel_identities_contactId_idx" ON "channel_identities"("contactId");

-- CreateIndex
CREATE INDEX "channel_identities_workspaceId_idx" ON "channel_identities"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_identities_workspaceId_id_key" ON "channel_identities"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_identities_channelId_externalContactId_key" ON "channel_identities"("channelId", "externalContactId");

-- CreateIndex
CREATE INDEX "inboxes_workspaceId_idx" ON "inboxes"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "inboxes_workspaceId_id_key" ON "inboxes"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "inbox_members_userId_idx" ON "inbox_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_members_inboxId_userId_key" ON "inbox_members"("inboxId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "channels_inboxId_key" ON "channels"("inboxId");

-- CreateIndex
CREATE INDEX "channels_workspaceId_channelType_idx" ON "channels"("workspaceId", "channelType");

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspaceId_id_key" ON "channels"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_workspaceId_channelType_providerAccountId_key" ON "channels"("workspaceId", "channelType", "providerAccountId");

-- CreateIndex
CREATE INDEX "channel_events_channelId_createdAt_idx" ON "channel_events"("channelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_events_channelId_externalEventId_key" ON "channel_events"("channelId", "externalEventId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_status_idx" ON "conversations"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_assigneeId_idx" ON "conversations"("workspaceId", "assigneeId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_teamId_idx" ON "conversations"("workspaceId", "teamId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_contactId_idx" ON "conversations"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_inboxId_idx" ON "conversations"("workspaceId", "inboxId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_lastActivityAt_idx" ON "conversations"("workspaceId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_workspaceId_id_key" ON "conversations"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_workspaceId_displayId_key" ON "conversations"("workspaceId", "displayId");

-- CreateIndex
CREATE INDEX "conversation_labels_labelId_idx" ON "conversation_labels"("labelId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_workspaceId_externalId_idx" ON "messages"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "messages_workspaceId_senderType_senderId_idx" ON "messages"("workspaceId", "senderType", "senderId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_workspaceId_id_key" ON "messages"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_externalId_key" ON "messages"("conversationId", "externalId");

-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- CreateIndex
CREATE INDEX "canned_responses_workspaceId_idx" ON "canned_responses"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_workspaceId_id_key" ON "canned_responses"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_workspaceId_shortCode_key" ON "canned_responses"("workspaceId", "shortCode");

-- CreateIndex
CREATE INDEX "labels_workspaceId_idx" ON "labels"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "labels_workspaceId_id_key" ON "labels"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "labels_workspaceId_title_key" ON "labels"("workspaceId", "title");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "products_workspaceId_isActive_idx" ON "products"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "products_workspaceId_barcode_idx" ON "products"("workspaceId", "barcode");

-- CreateIndex
CREATE INDEX "products_workspaceId_name_idx" ON "products"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "products_workspaceId_category_idx" ON "products"("workspaceId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "products_workspaceId_id_key" ON "products"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_workspaceId_sku_key" ON "products"("workspaceId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_workspaceId_slug_key" ON "products"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "product_variants_workspaceId_productId_idx" ON "product_variants"("workspaceId", "productId");

-- CreateIndex
CREATE INDEX "product_variants_workspaceId_barcode_idx" ON "product_variants"("workspaceId", "barcode");

-- CreateIndex
CREATE INDEX "product_variants_workspaceId_isActive_idx" ON "product_variants"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_workspaceId_id_key" ON "product_variants"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_workspaceId_sku_key" ON "product_variants"("workspaceId", "sku");

-- CreateIndex
CREATE INDEX "orders_workspaceId_status_idx" ON "orders"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "orders_workspaceId_paymentStatus_idx" ON "orders"("workspaceId", "paymentStatus");

-- CreateIndex
CREATE INDEX "orders_workspaceId_paymentMethod_idx" ON "orders"("workspaceId", "paymentMethod");

-- CreateIndex
CREATE INDEX "orders_workspaceId_contactId_idx" ON "orders"("workspaceId", "contactId");

-- CreateIndex
CREATE INDEX "orders_workspaceId_conversationId_idx" ON "orders"("workspaceId", "conversationId");

-- CreateIndex
CREATE INDEX "orders_workspaceId_createdAt_idx" ON "orders"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_workspaceId_id_key" ON "orders"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_workspaceId_displayId_key" ON "orders"("workspaceId", "displayId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_workspaceId_orderNumber_key" ON "orders"("workspaceId", "orderNumber");

-- CreateIndex
CREATE INDEX "order_items_workspaceId_orderId_idx" ON "order_items"("workspaceId", "orderId");

-- CreateIndex
CREATE INDEX "order_items_workspaceId_productId_idx" ON "order_items"("workspaceId", "productId");

-- CreateIndex
CREATE INDEX "order_items_workspaceId_variantId_idx" ON "order_items"("workspaceId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_workspaceId_id_key" ON "order_items"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "payment_transactions_workspaceId_orderId_idx" ON "payment_transactions"("workspaceId", "orderId");

-- CreateIndex
CREATE INDEX "payment_transactions_workspaceId_transactionCode_idx" ON "payment_transactions"("workspaceId", "transactionCode");

-- CreateIndex
CREATE INDEX "payment_transactions_workspaceId_status_idx" ON "payment_transactions"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_workspaceId_createdAt_idx" ON "payment_transactions"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_workspaceId_id_key" ON "payment_transactions"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_workspaceId_idempotencyKey_key" ON "payment_transactions"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "inventory_transactions_workspaceId_variantId_createdAt_idx" ON "inventory_transactions"("workspaceId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_workspaceId_orderId_idx" ON "inventory_transactions"("workspaceId", "orderId");

-- CreateIndex
CREATE INDEX "inventory_transactions_workspaceId_type_idx" ON "inventory_transactions"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_workspaceId_id_key" ON "inventory_transactions"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actorId_idx" ON "platform_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_idx" ON "platform_audit_logs"("action");

-- CreateIndex
CREATE INDEX "platform_audit_logs_targetType_targetId_idx" ON "platform_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_idx" ON "KnowledgeArticle"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_workspaceId_isActive_idx" ON "KnowledgeArticle"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_workspaceId_id_key" ON "KnowledgeArticle"("workspaceId", "id");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_members" ADD CONSTRAINT "inbox_members_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_members" ADD CONSTRAINT "inbox_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channelIdentityId_fkey" FOREIGN KEY ("channelIdentityId") REFERENCES "channel_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_labels" ADD CONSTRAINT "conversation_labels_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_labels" ADD CONSTRAINT "conversation_labels_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
