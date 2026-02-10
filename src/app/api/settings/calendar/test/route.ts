import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchCalendarEvents } from "@/lib/user-calendar";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }
  const integration = await prisma.userCalendarIntegration.findUnique({
    where: { userId: user.id },
  });
  if (!integration?.refreshToken) {
    return NextResponse.json({ events: [], connected: false });
  }
  const events = await fetchCalendarEvents(request, integration);
  return NextResponse.json({ events, connected: true });
}
