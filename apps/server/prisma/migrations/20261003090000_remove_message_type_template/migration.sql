-- Remove MessageType.TEMPLATE: the value has no producers or consumers.
-- PostgreSQL has no ALTER TYPE ... DROP VALUE, so the enum type is rebuilt.
CREATE TYPE "MessageType_new" AS ENUM ('INCOMING', 'OUTGOING', 'ACTIVITY');

ALTER TABLE "messages"
  ALTER COLUMN "messageType" DROP DEFAULT,
  ALTER COLUMN "messageType" TYPE "MessageType_new"
    USING (
      CASE
        WHEN "messageType"::text = 'TEMPLATE' THEN 'ACTIVITY'::text
        ELSE "messageType"::text
      END
    )::"MessageType_new",
  ALTER COLUMN "messageType" SET DEFAULT 'INCOMING'::"MessageType_new";

ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "MessageType_old";
