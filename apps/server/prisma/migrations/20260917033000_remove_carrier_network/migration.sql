-- AlterTable
ALTER TABLE "shipping_addresses" DROP COLUMN "carrierNetwork";

-- DropEnum
DROP TYPE "CarrierNetwork";
