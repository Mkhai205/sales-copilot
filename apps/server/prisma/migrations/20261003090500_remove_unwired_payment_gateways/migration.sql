-- Remove PaymentGateway.VNPAY / MOMO: declared but never wired to any
-- integration. PostgreSQL has no ALTER TYPE ... DROP VALUE, so the enum
-- type is rebuilt; stray rows (none expected) map onto MANUAL.
CREATE TYPE "PaymentGateway_new" AS ENUM ('SEPAY', 'CASSO', 'MANUAL');

ALTER TABLE "payment_transactions"
  ALTER COLUMN "gateway" DROP DEFAULT,
  ALTER COLUMN "gateway" TYPE "PaymentGateway_new"
    USING (
      CASE
        WHEN "gateway"::text IN ('VNPAY', 'MOMO') THEN 'MANUAL'::text
        ELSE "gateway"::text
      END
    )::"PaymentGateway_new",
  ALTER COLUMN "gateway" SET DEFAULT 'MANUAL'::"PaymentGateway_new";

ALTER TYPE "PaymentGateway" RENAME TO "PaymentGateway_old";
ALTER TYPE "PaymentGateway_new" RENAME TO "PaymentGateway";
DROP TYPE "PaymentGateway_old";
