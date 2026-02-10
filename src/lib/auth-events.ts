import { prisma } from "./db";
import { headers } from "next/headers";

type EventType = "login_success" | "login_failed" | "logout";

export async function recordAuthEvent(params: {
  userId?: string | null;
  usernameAttempted?: string | null;
  eventType: EventType;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const headersList = await headers();
  const ip = params.ip ?? headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? null;
  const userAgent = params.userAgent ?? headersList.get("user-agent") ?? null;
  await prisma.authEvent.create({
    data: {
      userId: params.userId ?? null,
      usernameAttempted: params.usernameAttempted ?? null,
      eventType: params.eventType,
      ip,
      userAgent,
    },
  });
}
