-- CreateTable
CREATE TABLE "user_calendar_integrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "scope" TEXT,
    "expiry_date" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_calendar_integrations_user_id_key" ON "user_calendar_integrations"("user_id");

-- AddForeignKey
ALTER TABLE "user_calendar_integrations" ADD CONSTRAINT "user_calendar_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable (old global calendar integration)
DROP TABLE IF EXISTS "calendar_integration";
