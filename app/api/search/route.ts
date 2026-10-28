import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectPatterns } from "@/lib/numbers/patterns";

/** Digit-box search over local listings: prefix=0912&mask=_00_0__ ("_" = blank box). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const prefix = searchParams.get("prefix") ?? "0912";
  const mask = (searchParams.get("mask") ?? "_______").padEnd(7, "_");
  if (!/^09\d{2}$/.test(prefix) || !/^[0-9_]{7}$/.test(mask)) {
    return NextResponse.json({ error: "پیش‌شماره یا الگو نامعتبر است" }, { status: 400 });
  }
  const pattern = prefix + mask; // "_" is LIKE's single-character wildcard
  const [rows, stats] = await Promise.all([
    prisma.$queryRaw<{ number: string; price: bigint | null; status: string | null }[]>`
      SELECT "number", "price", "status" FROM "Listing"
      WHERE "number" LIKE ${pattern}
      ORDER BY "price" ASC NULLS LAST LIMIT 200`,
    prisma.$queryRaw<{ total: bigint; priced: bigint; median: number | null }[]>`
      SELECT count(*) AS total, count("price") AS priced,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "price") AS median
      FROM "Listing" WHERE "number" LIKE ${pattern}`,
  ]);
  return NextResponse.json({
    prefix,
    mask,
    total: Number(stats[0].total),
    priced: Number(stats[0].priced),
    median: stats[0].median == null ? null : Math.round(Number(stats[0].median)),
    items: rows.map((r) => ({
      number: r.number,
      price: r.price == null ? null : Number(r.price),
      status: r.status,
      patterns: detectPatterns(r.number.slice(4), r.number.slice(0, 4)).slice(0, 2).map((t) => t.label),
    })),
  });
}
