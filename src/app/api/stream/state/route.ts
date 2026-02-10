import { NextResponse } from "next/server";
import { maybeExpireStreamer, getStreamState } from "@/lib/stream-state";

export async function GET() {
  await maybeExpireStreamer();
  const state = await getStreamState();
  if (!state) {
    return NextResponse.json({ error: "Stream state not found" }, { status: 500 });
  }
  return NextResponse.json({
    activeStreamerUserId: state.activeStreamerUserId,
    isLive: state.isLive,
    liveStartedAt: state.liveStartedAt?.toISOString() ?? null,
    lastHeartbeatAt: state.lastHeartbeatAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
  });
}
