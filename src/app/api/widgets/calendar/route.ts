import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fetchCalendarEvents } from "@/lib/user-calendar";

export async function GET(request: NextRequest) {
  const state = await prisma.streamState.findUnique({
    where: { id: 1 },
    include: { activeStreamer: { select: { id: true, displayName: true } } },
  });
  const activeStreamerUserId = state?.activeStreamerUserId ?? null;
  const activeStreamer = state?.activeStreamer ?? null;

  if (!activeStreamerUserId || !activeStreamer) {
    return NextResponse.json({
      connected: false,
      reason: "no_streamer",
      sourceUserId: null,
      sourceDisplayName: null,
      events: [],
    });
  }

  const integration = await prisma.userCalendarIntegration.findUnique({
    where: { userId: activeStreamerUserId },
  });
  if (!integration?.refreshToken) {
    return NextResponse.json({
      connected: false,
      reason: "streamer_not_connected",
      sourceUserId: activeStreamerUserId,
      sourceDisplayName: activeStreamer.displayName,
      events: [],
    });
  }

  try {
    const events = await fetchCalendarEvents(request, integration);
    return NextResponse.json({
      connected: true,
      reason: null,
      sourceUserId: activeStreamerUserId,
      sourceDisplayName: activeStreamer.displayName,
      events,
    });
  } catch {
    return NextResponse.json({
      connected: false,
      reason: "error",
      sourceUserId: activeStreamerUserId,
      sourceDisplayName: activeStreamer.displayName,
      events: [],
    });
  }
}
