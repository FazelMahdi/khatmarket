import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { importPages } from "../lib/import";

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is required");
  // Re-running the seed also resets the admin password to ADMIN_PASSWORD.
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash, role: "ADMIN" },
    update: { passwordHash, role: "ADMIN" },
  });
  const sample = JSON.parse(readFileSync("data/sample-mci-0912.json", "utf8"));
  console.log(`admin ready: username "${username}", password from ADMIN_PASSWORD in .env`, "| sample listings:", await importPages(sample, "sample"));
}

main().finally(() => prisma.$disconnect());
