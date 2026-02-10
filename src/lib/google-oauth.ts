/**
 * Compute redirect URI for Google OAuth from the incoming request.
 * Use request origin so it works locally and on Vercel without GOOGLE_OAUTH_REDIRECT_URI.
 * No trailing slash.
 */
export function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const origin = `${proto}://${host}`.replace(/\/$/, "");
  return `${origin}/api/google/oauth/callback`;
}
