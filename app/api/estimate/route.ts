import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadListings } from "@/lib/listings";
import { loadModel } from "@/lib/model";
import { estimatePrice, type Estimate } from "@/lib/numbers/estimate";
import { parseMobile } from "@/lib/numbers/normalize";
import { detectPatterns } from "@/lib/numbers/patterns";
import { ALGORITHM_BY_ID } from "@/lib/numbers/algorithms";
import { rondApi } from "@/lib/rond/client";
import { findSimilar } from "@/lib/rond/similar";
import { getSession } from "@/lib/session";

/** Most similar listings live on rond.ir; the local database is the fallback. */
async function estimate(full: string): Promise<Estimate | null> {
  try {
    const base = estimatePrice(full, [])!;
    const live = await findSimilar(full, rondApi);
    const patterns = live.types.map((t) => ({
      key: ALGORITHM_BY_ID.get(t.id)?.key ?? t.id,
      label: t.algorithm,
      priority: t.priority,
      strength: 1,
    }));
    return {
      ...base,
      // rond.ir's own classification replaces the local detectors when it has one
      ...(patterns.length ? { patterns, primary: patterns[0] } : {}),
      price: live.price,
      confidence: live.confidence,
      method: live.price ? "rond" : "none",
      pricedListings: live.matches.length,
      neighbors: live.matches.slice(0, 10).map((m) => ({
        number: m.number,
        price: m.price,
        similarity: (m.same + m.shape) / 9.75,
        patterns: m.types ?? detectPatterns(m.number.slice(4), m.number.slice(0, 4)).map((t) => t.label),
      })),
    };
  } catch (e) {
    console.warn("[estimate] live rond.ir search failed, using local listings:", (e as Error).message);
    return estimatePrice(full, await loadListings(), loadModel());
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { number?: string } | null;
  const parsed = parseMobile(String(body?.number ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "شماره موبایل معتبر نیست (مثال: 09121003088)" }, { status: 400 });
  }
  const result = await estimate(parsed.full);
  if (!result) return NextResponse.json({ error: "خطا در محاسبه" }, { status: 500 });

  const session = await getSession();
  if (session) {
    await prisma.lookup.create({ data: { userId: session.id, number: parsed.full, result: JSON.parse(JSON.stringify(result)) } });
  }
  return NextResponse.json(result);
}
