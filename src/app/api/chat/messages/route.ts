import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Ably from "ably";

const LATEST_LIMIT = 50;

/** GET: latest 50 chat messages (asc order for display). */
export async function GET() {
  try {
    await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }

  const messages = await prisma.chatMessage.findMany({
    take: LATEST_LIMIT,
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
    user: { id: m.user.id, displayName: m.user.displayName },
  }));

  return NextResponse.json({ messages: items });
}

/** POST: create message, persist to DB, publish to Ably hud:chat. */
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

  const payload = {
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    user: { id: created.user.id, displayName: created.user.displayName },
  };

  const key = process.env.ABLY_API_KEY;
  if (key) {
    try {
      const rest = new Ably.Rest({ key });
      await rest.channels.get("hud:chat").publish("message", payload);
    } catch (ablyErr) {
      console.error("[chat] Ably publish failed:", ablyErr);
      // Message is already in DB; client can refetch or we could retry
    }
  }

  return NextResponse.json({
    id: created.id,
    text: created.text,
    createdAt: created.createdAt.toISOString(),
    user: { id: created.user.id, displayName: created.user.displayName },
  });
}
