import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/panel/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/panel", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*"] };
