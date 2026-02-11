import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** GET: latest chat messages (asc order for display). Query: ?limit=50 */
export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    limitParam ? Math.max(1, Number(limitParam)) : DEFAULT_LIMIT,
    MAX_LIMIT
  );

  const messages = await prisma.chatMessage.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, displayName: true },
      },
    },
  });

  const items = [...messages].reverse().map((m) => ({
    id: m.id,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
    authorDisplayName: m.user.displayName,
    user: { id: m.user.id, displayName: m.user.displayName },
  }));

  return NextResponse.json({ messages: items });
}

/** POST: create message, persist to DB. Client broadcasts via Supabase Realtime. */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const created = await prisma.chatMessage.create({
    data: { userId: user.id, text },
    include: {
      user: {
        select: { id: true, displayName: true },
      },
    },
  });

  return NextResponse.json({
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    authorDisplayName: created.user.displayName,
    user: { id: created.user.id, displayName: created.user.displayName },
  });
}
