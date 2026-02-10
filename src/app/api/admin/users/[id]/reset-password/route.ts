import { NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { revokeAllSessionsForUser } from "@/lib/session";

const bodySchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Forbidden" }, { status: err.statusCode ?? 403 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const { newPassword } = bodySchema.parse(body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });
    await revokeAllSessionsForUser(id);
    await writeAuditLog({
      actorUserId: admin.id,
      action: "user.reset_password",
      targetUserId: id,
      metadata: { username: user.username },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    throw e;
  }
}
