import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const STREAM_STATE_ID = 1;

export async function GET() {
  const row = await prisma.telemetryLatest.findUnique({
    where: { streamStateId: STREAM_STATE_ID },
  });
  if (!row) {
    return NextResponse.json({
      lat: null,
      lon: null,
      headingDeg: null,
      accuracyM: null,
      updatedAt: null,
    });
  }
  return NextResponse.json({
    lat: row.lat,
    lon: row.lon,
    headingDeg: row.headingDeg,
    accuracyM: row.accuracyM,
    updatedAt: row.updatedAt.toISOString(),
  });
}
