import { NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { currentPassword, newPassword } = bodySchema.parse(body);
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const ok = await argon2.verify(dbUser.passwordHash, currentPassword);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }
    const err = e as { statusCode?: number };
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: err.statusCode ?? 401 }
    );
  }
}
