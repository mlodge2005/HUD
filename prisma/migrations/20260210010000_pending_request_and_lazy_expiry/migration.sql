-- AlterTable
ALTER TABLE "stream_state" ADD COLUMN "pending_request_from_user_id" UUID,
ADD COLUMN "pending_request_at" TIMESTAMP(3);
