import { getSessionFromCookie } from "./session";
import { prisma } from "./db";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  mustChangePassword: boolean;
};

export async function requireAuth(): Promise<AuthUser> {
  const session = await getSessionFromCookie();
  if (!session) {
    throw new AuthError("Unauthorized", 401);
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user || user.disabled) {
    throw new AuthError("Unauthorized", 401);
  }
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

export async function getOptionalAuth(): Promise<AuthUser | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}
