-- CreateTable
CREATE TABLE "calendar_integration" (
    "id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "calendar_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "scope" TEXT,
    "expiry_date" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_integration_pkey" PRIMARY KEY ("id")
);

-- Ensure single row id=1 exists
INSERT INTO "calendar_integration" ("id", "provider", "calendar_id", "updated_at")
VALUES (1, 'google', '', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
