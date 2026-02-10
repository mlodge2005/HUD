import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { revokeAllSessionsForUser } from "@/lib/session";

const patchSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(["admin", "user"]).optional(),
  disabled: z.boolean().optional(),
});

export async function PATCH(
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
    const data = patchSchema.parse(body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // Prevent admin disabling themselves
    if (data.disabled === true && user.id === admin.id) {
      return NextResponse.json(
        { error: "Cannot disable your own account" },
        { status: 400 }
      );
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.disabled !== undefined && { disabled: data.disabled }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        disabled: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });
    if (data.disabled === true) {
      await revokeAllSessionsForUser(id);
    }
    await writeAuditLog({
      actorUserId: admin.id,
      action: "user.update",
      targetUserId: id,
      metadata: data,
    });
    return NextResponse.json(updated);
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

export async function DELETE(
  _request: Request,
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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.id === admin.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }
  const adminCount = await prisma.user.count({
    where: { role: "admin" },
  });
  if (user.role === "admin" && adminCount <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last admin" },
      { status: 400 }
    );
  }
  await prisma.user.delete({ where: { id } });
  await writeAuditLog({
    actorUserId: admin.id,
    action: "user.delete",
    targetUserId: id,
    metadata: { username: user.username },
  });
  return NextResponse.json({ ok: true });
}
