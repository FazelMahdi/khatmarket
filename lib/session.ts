import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "USER";
export interface Session {
  id: string;
  username: string;
  role: Role;
}

export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7;

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
};

export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { id: String(payload.sub), username: String(payload.username), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ username: s.username, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
