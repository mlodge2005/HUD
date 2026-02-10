import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: all users (id, displayName, role, disabled). Auth required. */
export async function GET() {
  try {
    await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, role: true, disabled: true },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      role: u.role,
      disabled: u.disabled,
    })),
  });
}
