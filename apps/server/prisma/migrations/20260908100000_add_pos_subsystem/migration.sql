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
CREATE TYPE "CarrierProvider" AS ENUM ('GHTK', 'GHN', 'VIETTEL_POST', 'AHAMOVE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CarrierNetwork" AS ENUM ('VIETTEL', 'VINAPHONE', 'MOBIFONE', 'VIETNAMOBILE', 'GMOBILE', 'ITEL', 'WINTEL', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'RESERVATION', 'RELEASE_RESERVATION', 'COMMIT_SALE', 'RETURN_RESTOCK', 'INVENTORY_AUDIT');

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
    "leadId" TEXT,
    "opportunityId" TEXT,
    "createdById" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
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

-- AlterSequence: Start displayId at 1000 for friendly order numbers
ALTER SEQUENCE "orders_displayId_seq" RESTART WITH 1000;

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
CREATE TABLE "shipping_addresses" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "contactId" TEXT,
    "recipientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "carrierNetwork" "CarrierNetwork" NOT NULL DEFAULT 'OTHER',
    "streetAddress" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'VN',
    "postalCode" TEXT,
    "shippingCarrier" "CarrierProvider" NOT NULL DEFAULT 'CUSTOM',
    "trackingCode" TEXT,
    "shippingNotes" TEXT,
    "carrierMetadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "products_workspaceId_id_key" ON "products"("workspaceId", "id");
CREATE UNIQUE INDEX "products_workspaceId_sku_key" ON "products"("workspaceId", "sku");
CREATE UNIQUE INDEX "products_workspaceId_slug_key" ON "products"("workspaceId", "slug");
CREATE INDEX "products_workspaceId_isActive_idx" ON "products"("workspaceId", "isActive");
CREATE INDEX "products_workspaceId_barcode_idx" ON "products"("workspaceId", "barcode");
CREATE INDEX "products_workspaceId_name_idx" ON "products"("workspaceId", "name");
CREATE INDEX "products_workspaceId_category_idx" ON "products"("workspaceId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_workspaceId_id_key" ON "product_variants"("workspaceId", "id");
CREATE UNIQUE INDEX "product_variants_workspaceId_sku_key" ON "product_variants"("workspaceId", "sku");
CREATE INDEX "product_variants_workspaceId_productId_idx" ON "product_variants"("workspaceId", "productId");
CREATE INDEX "product_variants_workspaceId_barcode_idx" ON "product_variants"("workspaceId", "barcode");
CREATE INDEX "product_variants_workspaceId_isActive_idx" ON "product_variants"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "orders_workspaceId_id_key" ON "orders"("workspaceId", "id");
CREATE UNIQUE INDEX "orders_workspaceId_displayId_key" ON "orders"("workspaceId", "displayId");
CREATE UNIQUE INDEX "orders_workspaceId_orderNumber_key" ON "orders"("workspaceId", "orderNumber");
CREATE INDEX "orders_workspaceId_status_idx" ON "orders"("workspaceId", "status");
CREATE INDEX "orders_workspaceId_paymentStatus_idx" ON "orders"("workspaceId", "paymentStatus");
CREATE INDEX "orders_workspaceId_contactId_idx" ON "orders"("workspaceId", "contactId");
CREATE INDEX "orders_workspaceId_conversationId_idx" ON "orders"("workspaceId", "conversationId");
CREATE INDEX "orders_workspaceId_leadId_idx" ON "orders"("workspaceId", "leadId");
CREATE INDEX "orders_workspaceId_opportunityId_idx" ON "orders"("workspaceId", "opportunityId");
CREATE INDEX "orders_workspaceId_createdAt_idx" ON "orders"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_workspaceId_id_key" ON "order_items"("workspaceId", "id");
CREATE INDEX "order_items_workspaceId_orderId_idx" ON "order_items"("workspaceId", "orderId");
CREATE INDEX "order_items_workspaceId_productId_idx" ON "order_items"("workspaceId", "productId");
CREATE INDEX "order_items_workspaceId_variantId_idx" ON "order_items"("workspaceId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_addresses_orderId_key" ON "shipping_addresses"("orderId");
CREATE UNIQUE INDEX "shipping_addresses_workspaceId_id_key" ON "shipping_addresses"("workspaceId", "id");
CREATE INDEX "shipping_addresses_workspaceId_trackingCode_idx" ON "shipping_addresses"("workspaceId", "trackingCode");
CREATE INDEX "shipping_addresses_workspaceId_phoneNumber_idx" ON "shipping_addresses"("workspaceId", "phoneNumber");
CREATE INDEX "shipping_addresses_workspaceId_province_district_idx" ON "shipping_addresses"("workspaceId", "province", "district");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_workspaceId_id_key" ON "payment_transactions"("workspaceId", "id");
CREATE UNIQUE INDEX "payment_transactions_workspaceId_idempotencyKey_key" ON "payment_transactions"("workspaceId", "idempotencyKey");
CREATE INDEX "payment_transactions_workspaceId_orderId_idx" ON "payment_transactions"("workspaceId", "orderId");
CREATE INDEX "payment_transactions_workspaceId_transactionCode_idx" ON "payment_transactions"("workspaceId", "transactionCode");
CREATE INDEX "payment_transactions_workspaceId_status_idx" ON "payment_transactions"("workspaceId", "status");
CREATE INDEX "payment_transactions_workspaceId_createdAt_idx" ON "payment_transactions"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_transactions_workspaceId_id_key" ON "inventory_transactions"("workspaceId", "id");
CREATE INDEX "inventory_transactions_workspaceId_variantId_createdAt_idx" ON "inventory_transactions"("workspaceId", "variantId", "createdAt");
CREATE INDEX "inventory_transactions_workspaceId_orderId_idx" ON "inventory_transactions"("workspaceId", "orderId");
CREATE INDEX "inventory_transactions_workspaceId_type_idx" ON "inventory_transactions"("workspaceId", "type");

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
ALTER TABLE "orders" ADD CONSTRAINT "orders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
