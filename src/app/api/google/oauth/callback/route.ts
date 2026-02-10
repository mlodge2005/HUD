import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getRedirectUri } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.redirect(new URL("/login?from=/settings", request.url));
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url));
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?error=config", request.url));
  }
  const redirectUri = getRedirectUri(request);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const { tokens } = await oauth2Client.getToken(code);
    const expiryDate = tokens.expiry_date ? BigInt(tokens.expiry_date) : null;
    const existing = await prisma.userCalendarIntegration.findUnique({
      where: { userId: user.id },
    });
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null;
    await prisma.userCalendarIntegration.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: "google",
        calendarId: "primary",
        accessToken: tokens.access_token ?? null,
        refreshToken,
        scope: tokens.scope ?? null,
        expiryDate,
      },
      update: {
        accessToken: tokens.access_token ?? null,
        refreshToken,
        scope: tokens.scope ?? null,
        expiryDate,
      },
    });
    await writeAuditLog({
      actorUserId: user.id,
      action: "user_connected_calendar",
      targetUserId: user.id,
    });
  } catch {
    return NextResponse.redirect(new URL("/settings?error=exchange", request.url));
  }
  return NextResponse.redirect(new URL("/settings?connected=1", request.url));
}
