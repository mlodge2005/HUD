import { NextResponse } from "next/server";
import { getSessionFromCookie, clearSessionCookie, revokeSession } from "@/lib/session";
import { recordAuthEvent } from "@/lib/auth-events";

export async function POST() {
  const session = await getSessionFromCookie();
  if (session) {
    await revokeSession(session.sessionId);
    await recordAuthEvent({
      userId: session.userId,
      eventType: "logout",
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
