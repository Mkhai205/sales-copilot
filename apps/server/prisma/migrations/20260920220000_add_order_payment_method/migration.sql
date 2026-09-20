-- AlterTable
ALTER TABLE "orders" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'COD';

-- CreateIndex
CREATE INDEX "orders_workspaceId_paymentMethod_idx" ON "orders"("workspaceId", "paymentMethod");
