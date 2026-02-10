import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { maybeExpireStreamer, getStreamState, adoptStreamer } from "@/lib/stream-state";

export async function POST() {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state) {
      return NextResponse.json({ error: "Stream state not found" }, { status: 500 });
    }
    if (state.activeStreamerUserId) {
      return NextResponse.json(
        { error: "There is already an active streamer" },
        { status: 400 }
      );
    }
    const newState = await adoptStreamer(user.id);
    return NextResponse.json({
      activeStreamerUserId: newState.activeStreamerUserId,
      isLive: newState.isLive,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
