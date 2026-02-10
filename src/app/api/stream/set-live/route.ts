import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { maybeExpireStreamer, getStreamState, setLive } from "@/lib/stream-state";

const bodySchema = z.object({ isLive: z.boolean() });

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state || state.activeStreamerUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the active streamer can set live status" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { isLive } = bodySchema.parse(body);
    const newState = await setLive(isLive);
    return NextResponse.json({ isLive: newState.isLive });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request" },
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
