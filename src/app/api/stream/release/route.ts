import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { maybeExpireStreamer, getStreamState, releaseStreamer } from "@/lib/stream-state";

export async function POST() {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state) {
      return NextResponse.json({ error: "Stream state not found" }, { status: 500 });
    }
    if (state.activeStreamerUserId !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only the active streamer or admin can release" },
        { status: 403 }
      );
    }
    await releaseStreamer();
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
