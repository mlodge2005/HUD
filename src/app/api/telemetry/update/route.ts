import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getStreamState } from "@/lib/stream-state";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  lat: z.number(),
  lon: z.number(),
  headingDeg: z.number().optional(),
  accuracyM: z.number().optional(),
});

const STREAM_STATE_ID = 1;

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const state = await getStreamState();
    if (!state || state.activeStreamerUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the active streamer can send telemetry" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const data = bodySchema.parse(body);
    await prisma.telemetryLatest.upsert({
      where: { streamStateId: STREAM_STATE_ID },
      create: {
        streamStateId: STREAM_STATE_ID,
        lat: data.lat,
        lon: data.lon,
        headingDeg: data.headingDeg ?? null,
        accuracyM: data.accuracyM ?? null,
      },
      update: {
        lat: data.lat,
        lon: data.lon,
        headingDeg: data.headingDeg ?? undefined,
        accuracyM: data.accuracyM ?? undefined,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
