import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }
  await prisma.userCalendarIntegration.updateMany({
    where: { userId: user.id },
    data: {
      accessToken: null,
      refreshToken: null,
      expiryDate: null,
      scope: null,
    },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "user_disconnected_calendar",
    targetUserId: user.id,
  });
  return NextResponse.json({ ok: true });
}
