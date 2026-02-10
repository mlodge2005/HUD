import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { heartbeat } from "@/lib/stream-state";

export async function POST() {
  try {
    const user = await requireAuth();
    const result = await heartbeat(user.id);
    if (!result.ok) {
      return NextResponse.json({ error: "Not the active streamer" }, { status: 400 });
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
