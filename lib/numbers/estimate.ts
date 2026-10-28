import { detectPatterns, features, type PatternMatch } from "./patterns";
import { parseMobile } from "./normalize";

export interface ListingInput {
  number: string;
  /** Asking price in toman; null for "call"/"agreement" listings */
  price: number | null;
  status?: string | null;
}

export interface Neighbor {
  number: string;
  price: number;
  similarity: number;
  patterns: string[];
}

export type Confidence = "low" | "medium" | "high";

export interface Estimate {
  number: string;
  prefix: string;
  patterns: PatternMatch[];
  primary: PatternMatch;
  /** null when there are no comparable priced listings */
  price: { low: number; mid: number; high: number } | null;
  confidence: Confidence;
  neighbors: Neighbor[];
  pricedListings: number;
}

const K = 8;
const MIN_SIMILARITY = 0.3;
const MIN_LISTINGS_FOR_HIGH = 200;

const weightOf = (priority: number) => 1 + (205 - priority) / 100;

function tagSimilarity(a: PatternMatch[], b: PatternMatch[]): number {
  const mb = new Map(b.map((m) => [m.key, m]));
  let inter = 0;
  let union = 0;
  const seen = new Set<string>();
  for (const m of a) {
    seen.add(m.key);
    const w = weightOf(m.priority);
    const o = mb.get(m.key);
    if (o) inter += w * Math.min(m.strength, o.strength);
    union += w * Math.max(m.strength, o?.strength ?? 0);
  }
  for (const m of b) if (!seen.has(m.key)) union += weightOf(m.priority) * m.strength;
  return union === 0 ? 0 : inter / union;
}

function positionalSimilarity(a: string, b: string): number {
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  let tail = 0;
  while (tail < a.length && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return 0.5 * (same / a.length) + 0.5 * (tail / a.length);
}

function similarity(qBody: string, qTags: PatternMatch[], lBody: string, lTags: PatternMatch[], samePrefix: boolean) {
  const fq = features(qBody);
  const fl = features(lBody);
  const feat =
    1 -
    (Math.abs(fq.maxRun - fl.maxRun) / 6 + Math.abs(fq.distinct - fl.distinct) / 6 + Math.abs(fq.seqEdge - fl.seqEdge) / 7) / 3;
  const primary = qTags[0].key === lTags[0].key ? 1 : 0;
  const s =
    0.45 * tagSimilarity(qTags, lTags) + 0.15 * primary + 0.15 * positionalSimilarity(qBody, lBody) + 0.25 * feat;
  return samePrefix ? s : s * 0.85;
}

function weightedQuantile(items: { v: number; w: number }[], q: number): number {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, i) => s + i.w, 0);
  let acc = 0;
  for (const it of sorted) {
    acc += it.w;
    if (acc / total >= q) return it.v;
  }
  return sorted[sorted.length - 1].v;
}

/** Round to 2 significant digits so results read like asking prices. */
const roundPrice = (n: number) => {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
};

export function estimatePrice(input: string, listings: ListingInput[]): Estimate | null {
  const parsed = parseMobile(input);
  if (!parsed) return null;
  const qTags = detectPatterns(parsed.body, parsed.prefix);

  const scored: (Neighbor & { w: number })[] = [];
  let priced = 0;
  for (const l of listings) {
    if (l.price == null || l.price <= 0 || l.number === parsed.full) continue;
    const lp = parseMobile(l.number);
    if (!lp) continue;
    priced++;
    const lTags = detectPatterns(lp.body, lp.prefix);
    const sim = similarity(parsed.body, qTags, lp.body, lTags, lp.prefix === parsed.prefix);
    if (sim < MIN_SIMILARITY) continue;
    scored.push({
      number: lp.full,
      price: l.price,
      similarity: sim,
      patterns: lTags.map((t) => t.label),
      w: sim ** 3,
    });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored.slice(0, K);

  const exact = listings.find((l) => l.number === parsed.full && l.price);
  let price: Estimate["price"] = null;
  let confidence: Confidence = "low";
  if (top.length > 0) {
    const pts = top.map((n) => ({ v: Math.log(n.price), w: n.w }));
    price = {
      low: roundPrice(Math.exp(weightedQuantile(pts, 0.25))),
      mid: roundPrice(Math.exp(weightedQuantile(pts, 0.5))),
      high: roundPrice(Math.exp(weightedQuantile(pts, 0.75))),
    };
    const avg = top.reduce((s, n) => s + n.similarity, 0) / top.length;
    const spread = price.high / price.low;
    confidence = top.length >= 5 && avg >= 0.7 ? "high" : top.length >= 3 && avg >= 0.5 ? "medium" : "low";
    // Few listings, a wide price spread, or an "ordinary" query all weaken the estimate.
    if (priced < MIN_LISTINGS_FOR_HIGH && confidence === "high") confidence = "medium";
    if (spread > 3 && confidence !== "low") confidence = confidence === "high" ? "medium" : "low";
    if (qTags[0].key === "ordinary" && confidence === "high") confidence = "medium";
  }
  if (exact?.price) {
    price = { low: exact.price, mid: exact.price, high: exact.price };
    confidence = "high";
  }

  return {
    number: parsed.full,
    prefix: parsed.prefix,
    patterns: qTags,
    primary: qTags[0],
    price,
    confidence,
    neighbors: top.map((n) => ({ number: n.number, price: n.price, similarity: n.similarity, patterns: n.patterns })),
    pricedListings: priced,
  };
}
