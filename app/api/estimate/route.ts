import { NextResponse } from "next/server";
import { aiPrice } from "@/lib/ai/pricer";
import { avalaiEnabled } from "@/lib/ai/avalai";
import { prisma } from "@/lib/db";
import { loadListings } from "@/lib/listings";
import { loadModel } from "@/lib/model";
import { estimatePrice, type Estimate } from "@/lib/numbers/estimate";
import { parseMobile } from "@/lib/numbers/normalize";
import { detectPatterns } from "@/lib/numbers/patterns";
import { ALGORITHM_BY_ID } from "@/lib/numbers/algorithms";
import { rondApi } from "@/lib/rond/client";
import { hasLocalCoverage, localRondApi } from "@/lib/rond/local-api";
import { listingsOf, rankAll } from "@/lib/rond/rank-all";
import { findSimilar } from "@/lib/rond/similar";
import { getSession } from "@/lib/session";

/**
 * Most similar listings: from the local copy of rond.ir when `rond:sync` has
 * filled it (all numbers, fast), else live on rond.ir; the old local
 * estimator is the last fallback. AvalAI then picks comparables and a price.
 */
async function estimate(full: string): Promise<Estimate | null> {
  const local = await hasLocalCoverage(full.slice(0, 4));
  let result: Estimate | null;
  try {
    const base = estimatePrice(full, [])!;
    // Locally: compare against every synced listing. Live: widening digit-box searches.
    const found = local
      ? rankAll(full, await listingsOf(full.slice(0, 4)), await localRondApi.types(full))
      : { scanned: undefined, ...(await findSimilar(full, rondApi)) };
    const scanned = found.scanned ?? found.matches.length;
    const patterns = found.types.map((t) => ({
      key: ALGORITHM_BY_ID.get(t.id)?.key ?? t.id,
      label: t.algorithm,
      priority: t.priority,
      strength: 1,
    }));
    const typesOf = (n: string, known?: string[]) => known ?? detectPatterns(n.slice(4), n.slice(0, 4)).map((t) => t.label);
    result = {
      ...base,
      // rond.ir's own classification replaces the local detectors when it has one
      ...(patterns.length ? { patterns, primary: patterns[0] } : {}),
      price: found.price,
      confidence: found.confidence,
      method: found.price ? "rond" : "none",
      source: local ? "local" : "live",
      pricedListings: scanned,
      neighbors: found.matches.slice(0, 10).map((m) => ({
        number: m.number,
        price: m.price,
        similarity: (m.same + m.shape) / 9.75,
        patterns: typesOf(m.number, m.types),
      })),
    };
    if (avalaiEnabled() && found.matches.length) {
      result.ai = await aiPrice(
        full,
        found.types.map((t) => t.algorithm),
        scanned,
        found.matches.slice(0, 30).map((m) => ({ number: m.number, price: m.price, types: typesOf(m.number, m.types), lost: m.lost })),
      ).catch((e) => {
        console.warn("[estimate] AvalAI:", (e as Error).message);
        return null;
      });
    }
  } catch (e) {
    console.warn("[estimate] rond.ir search failed, using local listings:", (e as Error).message);
    result = estimatePrice(full, await loadListings(), loadModel());
  }
  return result;
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
