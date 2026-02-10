import { NextResponse } from "next/server";

export async function GET() {
  // Stub: mock next 3–5 events
  const events = [
    { id: "1", title: "Team standup", start: new Date(Date.now() + 3600000).toISOString(), end: new Date(Date.now() + 3700000).toISOString() },
    { id: "2", title: "Review session", start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 86640000).toISOString() },
    { id: "3", title: "Demo", start: new Date(Date.now() + 172800000).toISOString(), end: new Date(Date.now() + 173160000).toISOString() },
  ];
  return NextResponse.json({ events });
}
