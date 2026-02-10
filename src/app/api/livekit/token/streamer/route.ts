import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { maybeExpireStreamer, getStreamState } from "@/lib/stream-state";
import { AccessToken, TrackSource } from "livekit-server-sdk";

const LIVEKIT_ROOM = "hud-room";

export async function POST() {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state || state.activeStreamerUserId !== user.id) {
      return NextResponse.json(
        { error: "Only the active streamer can publish" },
        { status: 403 }
      );
    }
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Streaming not configured" },
        { status: 503 }
      );
    }
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.displayName,
    });
    at.addGrant({
      roomJoin: true,
      room: LIVEKIT_ROOM,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      canPublishSources: [TrackSource.CAMERA],
    });
    const token = await at.toJwt();
    return NextResponse.json({ token, url });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
