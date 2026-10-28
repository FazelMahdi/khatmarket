/**
 * Finds the listings on rond.ir most similar to a number, live:
 * 1. rond.ir's own "نوع رند" of the number (rond-bot), e.g. 09121003088 = کد پایین + هزاری از اول.
 * 2. Digit-box searches restricted to those types (rondTypeIds is AND): the exact
 *    number, every one-box change, then blanking boxes from the right so the
 *    leading "code" digits stay, until enough priced listings are found.
 *    Then the 9 shifted copies (1234567 -> 2345678 ...) with any type: same exact shape.
 * 3. Ranking: how much of the rond structure (repeated digits, sequence runs) is lost, plus
 *    a penalty for a different rond.ir type set (checked for the top candidates), then same
 *    boxes and shape.
 */

export interface RondItem {
  simCardNumber: string;
  price: number | null;
  simCardStatus?: string | null;
}

export interface RondType {
  id: string;
  algorithm: string;
  priority: number;
}

export interface RondApi {
  /** One rond.ir search: pre-code + 7-box pattern ("\d" = blank box) + all of these types. */
  search(precode: string, pattern: string, typeIds: string[]): Promise<RondItem[]>;
  /** rond.ir's types for a full number ([] = ordinary). */
  types(full: string): Promise<RondType[]>;
}

export interface SimilarListing {
  number: string;
  price: number;
  status: string | null;
  /** boxes with the same digit as the query, leading boxes weigh more (max 8.75) */
  same: number;
  /** 0..1, how much the digit-equality shape matches */
  shape: number;
  /** 0..1, share of rond structure broken either way (09122002022 adds 2s to 1003088's shape, so it is not "the same") */
  lost: number;
  /** rond.ir types of the listing, when checked */
  types?: string[];
  /** 0..1, Jaccard overlap with the query's types (when checked) */
  typeMatch?: number;
}

export interface SimilarResult {
  types: RondType[];
  matches: SimilarListing[];
  price: { low: number; mid: number; high: number } | null;
  confidence: "low" | "medium" | "high";
  /** rond.ir requests made */
  queries: number;
}

const MIN_PRICED = 8;
const CHECK_TYPES = 15;
const TOP = 10;
const CONCURRENCY = 4;
// Leading boxes are the "code" (0912 100…); a change there moves the price more than the last digits.
const BOX_WEIGHT = [1.5, 1.42, 1.33, 1.25, 1.17, 1.08, 1];

/** All masks of `body` with exactly `k` blank boxes. */
export function blankMasks(body: string, k: number): string[] {
  const out: string[] = [];
  const pick = (from: number, blanks: number[]) => {
    if (blanks.length === k) return void out.push([...body].map((c, i) => (blanks.includes(i) ? "_" : c)).join(""));
    for (let i = from; i < body.length; i++) pick(i + 1, [...blanks, i]);
  };
  pick(0, []);
  return out;
}

/** Search rounds, narrowest first: exact + one-box changes, then "starts with" 5..0 boxes. */
export function maskRounds(body: string): string[][] {
  const rounds = [[body, ...blankMasks(body, 1)]];
  for (let keep = body.length - 2; keep >= 0; keep--) rounds.push([body.slice(0, keep).padEnd(body.length, "_")]);
  return rounds;
}

/** 1234567 -> 2345678, 3456789, ...: every digit +1..+9, so equal digits and steps stay. */
export const shifts = (body: string) => Array.from({ length: 9 }, (_, d) => [...body].map((c) => (+c + d + 1) % 10).join(""));

export const toRondPattern = (mask: string) => mask.replace(/_/g, "\\d");

export function shapeScore(a: string, b: string): number {
  let agree = 0;
  let pairs = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++, pairs++) if ((a[i] === a[j]) === (b[i] === b[j])) agree++;
  return agree / pairs;
}

const step = (b: string, i: number) => (+b[i + 1] - +b[i] + 10) % 10;

/**
 * Share (0..1) of the rond structure of `body` that `cand` breaks. Each repeated-digit group
 * and each ±1 run of 3+ digits is worth len², so value grows faster than length: breaking
 * 1234567 in the middle (1230789) loses most of it, a changed last digit of 1003088 little.
 */
export function structureLoss(body: string, cand: string): number {
  let total = 0;
  let kept = 0;
  const groups = new Map<string, number[]>();
  [...body].forEach((d, i) => groups.set(d, [...(groups.get(d) ?? []), i]));
  for (const pos of groups.values()) {
    if (pos.length < 2) continue;
    const counts = new Map<string, number>();
    for (const i of pos) counts.set(cand[i], (counts.get(cand[i]) ?? 0) + 1);
    total += pos.length ** 2;
    kept += Math.max(...counts.values()) ** 2;
  }
  for (let i = 0; i + 1 < body.length; ) {
    const s = step(body, i);
    let j = i;
    while (j + 1 < body.length && step(body, j) === s) j++;
    if ((s === 1 || s === 9) && j - i >= 2) {
      let best = 0;
      for (let k = i, run = 0; k < j; k++) best = Math.max(best, (run = step(cand, k) === s ? run + 1 : 0));
      total += (j - i + 1) ** 2;
      kept += (best + 1) ** 2;
    }
    i = Math.max(j, i + 1);
  }
  return total ? (total - kept) / total : 0;
}

const jaccard = (a: string[], b: string[]) => {
  const union = new Set([...a, ...b]);
  return union.size ? a.filter((x) => b.includes(x)).length / union.size : 1;
};

const score = (m: SimilarListing) => m.same + m.shape;
// Structure 3, rond.ir type 2: 09124567890 (same 7-run, fewer types) beats 09121230789
// for 09121234567, but 09122114199 (same shape, no "کد پایین") stays behind 09121003188
// for 09121003088.
const distance = (m: SimilarListing) => 3 * m.lost + 2 * (1 - (m.typeMatch ?? 0.5));
const rank = (a: SimilarListing, b: SimilarListing) =>
  distance(a) - distance(b) || score(b) - score(a) || a.price - b.price;

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
};

const roundPrice = (n: number) => {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
};

async function inChunks<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) out.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))));
  return out;
}

export async function findSimilar(full: string, api: RondApi): Promise<SimilarResult> {
  const prefix = full.slice(0, 4);
  const body = full.slice(4);
  const found = new Map<string, SimilarListing>();
  const types = await api.types(full);
  let queries = 1;

  const run = async (masks: string[], typeIds: string[]) => {
    const pages = await inChunks(masks, (m) => api.search(prefix, toRondPattern(m), typeIds));
    queries += pages.length;
    for (const item of pages.flat()) {
      const n = item.simCardNumber;
      if (!item.price || item.price <= 0 || found.has(n) || !n.startsWith(prefix)) continue;
      const b = n.slice(4);
      const same = [...b].reduce((s, c, k) => s + (c === body[k] ? BOX_WEIGHT[k] : 0), 0);
      found.set(n, { number: n, price: item.price, status: item.simCardStatus ?? null, same, shape: shapeScore(body, b), lost: Math.max(structureLoss(body, b), structureLoss(b, body)) });
    }
  };

  // All of the number's types, then only its strongest one, then no type filter.
  const ids = [...types].sort((a, b) => a.priority - b.priority).map((t) => t.id);
  const stages = [...new Set([ids.join(), ids.slice(0, 1).join(), ""])].map((s) => (s ? s.split(",") : []));
  // ponytail: one page of 500 per search; the widest rounds may miss near numbers past it.
  search: for (const typeIds of stages)
    for (const masks of maskRounds(body)) {
      await run(masks, typeIds);
      if (found.size >= MIN_PRICED) break search;
    }
  await run(shifts(body), []);

  const qTypes = types.map((t) => t.algorithm);
  const byScore = [...found.values()].sort(rank);
  const checked = byScore.slice(0, CHECK_TYPES);
  await inChunks(checked, async (m) => {
    m.types = (await api.types(m.number)).map((t) => t.algorithm);
    m.typeMatch = jaccard(qTypes, m.types);
  });
  queries += checked.length;
  const matches = [...checked.sort(rank), ...byScore.slice(CHECK_TYPES)];

  const exact = found.get(full);
  if (exact) return { types, matches, price: { low: exact.price, mid: exact.price, high: exact.price }, confidence: "high", queries };

  const top = matches.slice(0, TOP);
  if (!top.length) return { types, matches, price: null, confidence: "low", queries };
  // Price only from listings about as close as the closest one; weaker ones would drag it
  // (09124567890 at 20B is the comparable for 09121234567, not the 0.3B part-sequences).
  const near = top.filter((m) => distance(m) <= distance(top[0]) + 0.5);
  const logs = near.map((m) => Math.log(m.price)).sort((a, b) => a - b);
  const price = {
    low: roundPrice(Math.exp(quantile(logs, 0.25))),
    mid: roundPrice(Math.exp(quantile(logs, 0.5))),
    high: roundPrice(Math.exp(quantile(logs, 0.75))),
  };
  // The nearest listings agreeing on price, with the same rond type, is what makes it trustworthy.
  const spread = price.high / price.low;
  let confidence: SimilarResult["confidence"] =
    near.length >= 3 && spread < 1.5 ? "high" : near.length >= 2 && spread < 3 ? "medium" : "low";
  if (top[0].typeMatch !== 1 && confidence === "high") confidence = "medium";
  if (distance(top[0]) > 1) confidence = "low";
  return { types, matches, price, confidence, queries };
}
