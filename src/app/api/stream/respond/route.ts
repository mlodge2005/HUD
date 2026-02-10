import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  maybeExpireStreamer,
  getStreamState,
  getPendingStreamRequest,
  clearPendingStreamRequest,
  handoffTo,
} from "@/lib/stream-state";

const bodySchema = z.object({
  accepted: z.boolean(),
  toUserId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await maybeExpireStreamer();
    const state = await getStreamState();
    if (!state) {
      return NextResponse.json({ error: "Stream state not found" }, { status: 500 });
    }
    const pending = await getPendingStreamRequest();
    if (!pending) {
      return NextResponse.json({ error: "No pending request" }, { status: 400 });
    }
    if (state.activeStreamerUserId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const { accepted, toUserId } = bodySchema.parse(body);
    if (pending.fromUserId !== toUserId) {
      return NextResponse.json({ error: "Mismatched requester" }, { status: 400 });
    }
    await clearPendingStreamRequest();
    if (accepted) {
      await handoffTo(toUserId);
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
