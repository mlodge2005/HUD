import { NextResponse } from "next/server";
import Ably from "ably";
import { requireAuth } from "@/lib/auth";

/**
 * Returns an Ably token request for the authenticated user.
 * Client uses this as authUrl so it never sees the API key.
 * clientId = user.id for presence and identified publishing.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const key = process.env.ABLY_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
    }
    const rest = new Ably.Rest({ key });
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: user.id,
    });
    return NextResponse.json(tokenRequest);
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
