import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { credentialsSchema } from "@/lib/auth-schema";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  const parsed = credentialsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { username, password } = parsed.data;
  const name = username.toLowerCase();
  if (await prisma.user.findUnique({ where: { username: name } })) {
    return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده است" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { username: name, passwordHash: await bcrypt.hash(password, 10), role: "USER" },
  });
  await createSession({ id: user.id, username: user.username, role: user.role });
  return NextResponse.json({ ok: true });
}
