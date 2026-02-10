import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
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
  return NextResponse.json({
    connected: Boolean(integration?.refreshToken),
    calendarId: integration?.calendarId ?? "primary",
  });
}

const postSchema = z.object({
  calendarId: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  const calendarId = parsed.success && parsed.data.calendarId !== undefined
    ? parsed.data.calendarId
    : "primary";
  await prisma.userCalendarIntegration.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      provider: "google",
      calendarId,
    },
    update: { calendarId },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "user_updated_calendar_id",
    targetUserId: user.id,
    metadata: { calendarId },
  });
  return NextResponse.json({ ok: true });
}
