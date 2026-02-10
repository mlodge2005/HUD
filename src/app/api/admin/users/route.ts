import { NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const createSchema = z.object({
  username: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]),
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Forbidden" }, { status: err.statusCode ?? 403 });
  }
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";
  const disabled = searchParams.get("disabled") ?? "";

  const where: { username?: { contains: string; mode: "insensitive" }; role?: string; disabled?: boolean } = {};
  if (search) where.username = { contains: search, mode: "insensitive" };
  if (role && (role === "admin" || role === "user")) where.role = role;
  if (disabled === "true") where.disabled = true;
  if (disabled === "false") where.disabled = false;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      disabled: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Forbidden" }, { status: err.statusCode ?? 403 });
  }
  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }
    const passwordHash = await argon2.hash(data.password);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        passwordHash,
        role: data.role,
        mustChangePassword: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        disabled: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    await writeAuditLog({
      actorUserId: admin.id,
      action: "user.create",
      targetUserId: user.id,
      metadata: { username: user.username },
    });
    return NextResponse.json(user);
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
