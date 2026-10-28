import { detectPatterns, features, type PatternMatch } from "./patterns";
import { parseMobile } from "./normalize";
import { buildMasks, formatMask, matchesMask } from "./mask";

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

export interface MaskSearch {
  mask: string;
  /** rond.ir notation, e.g. 0912-00-0 */
  display: string;
  reason: string;
  count: number;
  median: number | null;
}

/** Learned adjustments (data/model.json, written by `npm run rond:learn`). */
export interface PriceModel {
  /** price multiplier of a pre-code relative to 0912 */
  precodeFactor?: Record<string, number>;
  /** price multiplier of a SIM status relative to LIKE_NEW */
  statusFactor?: Record<string, number>;
  /** minimum comparable listings for a mask to be trusted */
  minMatches?: number;
}

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
  /** How the price was found */
  method: "exact" | "mask" | "similarity" | "none";
  /** The digit-box search the price is based on (method "mask") */
  search: MaskSearch | null;
  /** Other searches a person could run, with their result counts */
  alternatives: MaskSearch[];
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

function similarityEstimate(input: string, listings: ListingInput[]): Estimate | null {
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
    method: exact?.price ? "exact" : price ? "similarity" : "none",
    search: null,
    alternatives: [],
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

interface Normalized {
  number: string;
  prefix: string;
  body: string;
  /** price adjusted to LIKE_NEW and to the query's pre-code */
  price: number;
  raw: number;
}

/**
 * Prices a number the way a person does on rond.ir: search with the digit boxes
 * (keep the rond digits, blank the rest), read the prices of the matches.
 * The most specific search that still has enough priced matches wins.
 */
export function estimatePrice(input: string, listings: ListingInput[], model: PriceModel = {}): Estimate | null {
  const base = similarityEstimate(input, listings);
  if (!base || base.method === "exact") return base;
  const { prefix, number } = base;
  const body = number.slice(4);

  // A match that carries a clearly stronger rond pattern than the query is a
  // different class of number (e.g. 1000799 vs 1003088), so it is skipped.
  const qKeys = new Set(base.patterns.map((t) => t.key));
  const qBest = base.primary.priority;
  const strongerThanQuery = (b: string, pre: string) =>
    detectPatterns(b, pre).some((t) => t.strength >= 0.7 && t.priority < qBest && !qKeys.has(t.key));

  const pf = model.precodeFactor ?? {};
  const sf = model.statusFactor ?? {};
  const qFactor = pf[prefix] ?? 1;
  const priced: Normalized[] = [];
  for (const l of listings) {
    if (l.price == null || l.price <= 0) continue;
    const p = parseMobile(l.number);
    if (!p || p.full === number || strongerThanQuery(p.body, p.prefix)) continue;
    const status = sf[l.status ?? ""] ?? 1;
    const pre = p.prefix === prefix ? 1 : qFactor / (pf[p.prefix] ?? 1);
    priced.push({ number: p.full, prefix: p.prefix, body: p.body, price: (l.price / status) * pre, raw: l.price });
  }

  // With little data, accept thinner evidence (still reported as low confidence).
  const minMatches = model.minMatches ?? (priced.length >= 2000 ? 5 : 2);
  const masks = buildMasks(body);
  const runs = masks.map((m) => {
    const same = priced.filter((l) => l.prefix === prefix && matchesMask(l.body, m.mask));
    const other = same.length >= minMatches ? [] : priced.filter((l) => l.prefix !== prefix && matchesMask(l.body, m.mask));
    const matches = same.length >= minMatches ? same : [...same, ...other];
    return { m, matches, sameOnly: same.length >= minMatches };
  });

  const toSearch = (r: (typeof runs)[number]): MaskSearch => ({
    mask: r.m.mask,
    display: formatMask(prefix, r.m.mask),
    reason: r.m.reason,
    count: r.matches.length,
    median: r.matches.length ? Math.round(median(r.matches.map((x) => x.price))) : null,
  });

  const usable = runs.filter((r) => r.matches.length >= minMatches);
  // Most fixed boxes first; same pre-code beats borrowed pre-codes; then more matches.
  usable.sort((a, b) => b.m.fixed - a.m.fixed || Number(b.sameOnly) - Number(a.sameOnly) || b.matches.length - a.matches.length);
  const alternatives = runs.filter((r) => r.matches.length > 0).map(toSearch).slice(0, 6);

  const best = usable[0];
  if (!best) return { ...base, alternatives };

  const prices = best.matches.map((x) => x.price).sort((a, b) => a - b);
  // Trim the extreme 10% on each side once there is enough data.
  const trimmed = prices.length >= 10 ? prices.slice(Math.floor(prices.length * 0.1), Math.ceil(prices.length * 0.9)) : prices;
  const logs = trimmed.map(Math.log);
  const roundP = (n: number) => {
    const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / mag) * mag;
  };
  const price = {
    low: roundP(Math.exp(quantile(logs, 0.25))),
    mid: roundP(Math.exp(quantile(logs, 0.5))),
    high: roundP(Math.exp(quantile(logs, 0.75))),
  };
  const spread = price.high / price.low;
  const n = best.matches.length;
  let confidence: Confidence = n >= 15 && spread < 2.5 ? "high" : n >= 5 && spread < 4 ? "medium" : "low";
  if (!best.sameOnly && confidence === "high") confidence = "medium";

  const neighbors: Neighbor[] = best.matches
    .sort((a, b) => Math.abs(Math.log(a.price / price.mid)) - Math.abs(Math.log(b.price / price.mid)))
    .slice(0, 8)
    .map((x) => ({
      number: x.number,
      price: x.raw,
      similarity: best.m.fixed / 7,
      patterns: detectPatterns(x.body, x.prefix).map((t) => t.label),
    }));

  return { ...base, price, confidence, neighbors, method: "mask", search: toSearch(best), alternatives };
}
