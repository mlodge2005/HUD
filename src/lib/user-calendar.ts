import { google } from "googleapis";
import type { UserCalendarIntegration } from "@prisma/client";
import { prisma } from "./db";
import { getRedirectUri } from "./google-oauth";

function getOAuth2Client(request: Request, integration: UserCalendarIntegration) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = getRedirectUri(request);
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials({
    access_token: integration.accessToken ?? undefined,
    refresh_token: integration.refreshToken ?? undefined,
    expiry_date: integration.expiryDate != null ? Number(integration.expiryDate) : undefined,
  });
  return client;
}

/** Ensure valid access token; refresh if expired. Persist new token if refreshed. */
export async function ensureValidToken(
  request: Request,
  integration: UserCalendarIntegration
): Promise<{ client: google.auth.OAuth2; integration: UserCalendarIntegration } | null> {
  const client = getOAuth2Client(request, integration);
  if (!client || !integration.refreshToken) return null;
  const nowMs = Date.now();
  if (
    integration.expiryDate != null &&
    Number(integration.expiryDate) <= nowMs + 60_000
  ) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const updated = await prisma.userCalendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: credentials.access_token ?? null,
          expiryDate: credentials.expiry_date ? BigInt(credentials.expiry_date) : null,
        },
      });
      client.setCredentials(credentials);
      return { client, integration: updated };
    } catch {
      return null;
    }
  }
  return { client, integration };
}

export type CalendarEventNormalized = {
  id: string;
  summary: string;
  startIso: string;
  endIso: string;
  startDisplay: string;
  endDisplay: string;
  dateDisplay: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Fetch upcoming events for an integration; returns next 5 with normalized display fields. */
export async function fetchCalendarEvents(
  request: Request,
  integration: UserCalendarIntegration
): Promise<CalendarEventNormalized[]> {
  const result = await ensureValidToken(request, integration);
  if (!result) return [];
  const calendar = google.calendar({ version: "v3", auth: result.client });
  const res = await calendar.events.list({
    calendarId: integration.calendarId,
    timeMin: new Date().toISOString(),
    maxResults: 5,
    singleEvents: true,
    orderBy: "startTime",
  });
  const items = res.data.items ?? [];
  return items.map((ev) => {
    const startDateTime = ev.start?.dateTime;
    const startDate = ev.start?.date;
    const endDateTime = ev.end?.dateTime;
    const endDate = ev.end?.date;
    const isAllDay = Boolean(startDate && !startDateTime);
    const startIso = startDateTime ?? startDate ?? new Date().toISOString();
    const endIso = endDateTime ?? endDate ?? new Date().toISOString();
    const dateDisplay = formatDate(startIso);
    const startDisplay = isAllDay ? "All day" : formatTime(startIso);
    const endDisplay = isAllDay ? "All day" : formatTime(endIso);
    return {
      id: ev.id ?? "",
      summary: ev.summary ?? "(No title)",
      startIso,
      endIso,
      startDisplay,
      endDisplay,
      dateDisplay,
    };
  });
}
