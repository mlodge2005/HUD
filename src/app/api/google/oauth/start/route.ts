import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/auth";
import { getRedirectUri } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.redirect(new URL("/login?from=/settings", request.url));
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured (missing env vars)" },
      { status: 503 }
    );
  }
  const redirectUri = getRedirectUri(request);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
  if (process.env.NODE_ENV !== "production") {
    const generated = new URL(url);
    console.log("[Google OAuth start] redirectUri passed to OAuth2Client:", redirectUri);
    console.log("[Google OAuth start] redirect_uri in generated auth URL:", generated.searchParams.get("redirect_uri"));
  }
  return NextResponse.redirect(url);
}
