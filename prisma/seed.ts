import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  // Ensure stream_state row with id=1 exists
  await prisma.streamState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? "Admin";

  if (!username || !password) {
    console.log("SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD not set; skipping admin creation.");
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.upsert({
    where: { username },
    create: {
      username,
      displayName,
      passwordHash,
      role: "admin",
      mustChangePassword: false,
    },
    update: {
      displayName,
      passwordHash,
      role: "admin",
      mustChangePassword: false,
    },
  });
  console.log("Seed admin user created/updated:", username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
