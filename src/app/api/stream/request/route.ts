import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  maybeExpireStreamer,
  getStreamState,
  setPendingStreamRequest,
} from "@/lib/stream-state";

export async function POST() {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state) {
      return NextResponse.json({ error: "Stream state not found" }, { status: 500 });
    }
    const result = await setPendingStreamRequest(user.id);
    if (!result.ok) {
      const status =
        result.error === "Another request is already pending" ? 409 :
        result.error === "Please wait before requesting again" ? 429 : 400;
      return NextResponse.json(
        { error: result.error ?? "Request failed" },
        { status }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
