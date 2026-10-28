import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;
  // Compare against a dummy hash when the user is unknown to keep timing similar.
  const hash = user?.passwordHash ?? "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.eFQ8m0qLZ2s7P3sQ0aG3zQp2yq6W";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }
  await createSession({ id: user.id, username: user.username, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
