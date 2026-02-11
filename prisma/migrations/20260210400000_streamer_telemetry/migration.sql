-- CreateTable
CREATE TABLE "streamer_telemetry" (
    "streamer_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streamer_telemetry_pkey" PRIMARY KEY ("streamer_id")
);
