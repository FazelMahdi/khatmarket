import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadListings } from "@/lib/listings";
import { estimatePrice } from "@/lib/numbers/estimate";
import { parseMobile } from "@/lib/numbers/normalize";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { number?: string } | null;
  const parsed = parseMobile(String(body?.number ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "شماره موبایل معتبر نیست (مثال: 09121003088)" }, { status: 400 });
  }
  const result = estimatePrice(parsed.full, await loadListings(parsed.prefix));
  if (!result) return NextResponse.json({ error: "خطا در محاسبه" }, { status: 500 });

  const session = await getSession();
  if (session) {
    await prisma.lookup.create({ data: { userId: session.id, number: parsed.full, result: JSON.parse(JSON.stringify(result)) } });
  }
  return NextResponse.json(result);
}
