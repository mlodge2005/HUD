import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Forbidden" }, { status: err.statusCode ?? 403 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const cursor = searchParams.get("cursor") ?? undefined;

  const events = await prisma.authEvent.findMany({
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
  });

  const nextCursor = events.length > limit ? events[limit - 1]?.id : null;
  const items = events.slice(0, limit);

  return NextResponse.json({
    events: items.map((e) => ({
      id: e.id,
      userId: e.userId,
      username: e.user?.username ?? e.usernameAttempted,
      eventType: e.eventType,
      ip: e.ip,
      userAgent: e.userAgent,
      createdAt: e.createdAt,
    })),
    nextCursor,
  });
}
