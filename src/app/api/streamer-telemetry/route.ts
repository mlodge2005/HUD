import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getStreamState } from "@/lib/stream-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  lat: z.number(),
  lon: z.number(),
  heading: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const state = await getStreamState();
    if (!state || state.activeStreamerUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the active streamer can publish telemetry" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const data = bodySchema.parse(body);
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("streamer_telemetry").upsert(
      {
        streamer_id: user.id,
        lat: data.lat,
        lon: data.lon,
        heading: data.heading ?? null,
        accuracy: data.accuracy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "streamer_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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
