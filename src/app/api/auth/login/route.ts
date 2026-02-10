import { NextResponse } from "next/server";
import { z } from "zod";
import * as argon2 from "argon2";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/session";
import { recordAuthEvent } from "@/lib/auth-events";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = bodySchema.parse(body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      await recordAuthEvent({
        usernameAttempted: username,
        eventType: "login_failed",
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }
    if (user.disabled) {
      await recordAuthEvent({
        usernameAttempted: username,
        eventType: "login_failed",
      });
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      );
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await recordAuthEvent({
        usernameAttempted: username,
        eventType: "login_failed",
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }
    const token = await createSession(user.id);
    await setSessionCookie(token);
    await recordAuthEvent({
      userId: user.id,
      usernameAttempted: username,
      eventType: "login_success",
    });
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    throw e;
  }
}
