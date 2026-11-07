/**
 * Price level of a number's code block: the first 1-3 digits after the pre-code
 * (کد ۱، کد ۲ … and inside code 1: 100, 101, 13x …). The level is the median
 * asking price of the plainest numbers in the block (the rest of the digits has
 * at most one repeated pair), so it carries the code's age and the block's own
 * pattern, not the rest's.
 *
 * Measured on all 49.7k 0912 listings on rond.ir (Nov 2026): the code effect is
 * multiplicative (same last 6 digits, different code: price ratio = 0.97 × the
 * code-level ratio), and inside code 1 it is steep (100: 5B, 101: 2B, 13x-19x:
 * ~0.85B). So a comparable from another block is scaled by the level ratio.
 */
import snapshot0912 from "../../data/levels-0912.json";
import { structureValue } from "./similar";

/** Level (toman) of a body's code block; undefined when unknown. */
export type Levels = (body: string) => number | undefined;

const MIN_LISTINGS = 15;
// structureValue of a single repeated pair is 4
const PLAIN = 4;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

const fromTable = (t: Record<string, number>): Levels => (b) => t[b.slice(0, 3)] ?? t[b.slice(0, 2)] ?? t[b[0]];

/** Levels from a pre-code's listings (rows of one pre-code). */
export function levelsFrom(rows: { number: string; price: number }[]): Levels {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const b = r.number.slice(4);
    for (const n of [1, 2, 3]) {
      if (structureValue(b.slice(n)) > PLAIN) continue;
      const k = b.slice(0, n);
      let prices = groups.get(k);
      if (!prices) groups.set(k, (prices = []));
      prices.push(r.price);
    }
  }
  const table: Record<string, number> = {};
  for (const [k, prices] of groups) if (prices.length >= MIN_LISTINGS) table[k] = median(prices);
  return fromTable(table);
}

// ponytail: one snapshot for 0912 (rond.ir, Nov 2026) for the live search, which never
// sees all listings; only ratios are used, so slow market drift barely matters.
// Regenerate from a full sync when code ratios move.
const SNAPSHOTS: Record<string, Levels> = { "0912": fromTable(snapshot0912) };

export const snapshotLevels = (prefix: string): Levels | undefined => SNAPSHOTS[prefix];

/** Factor that brings a price of body `c` to the code block of body `q` (1 when unknown). */
export function levelRatio(levels: Levels | undefined, q: string, c: string): number {
  const a = levels?.(q);
  const b = levels?.(c);
  return a && b ? a / b : 1;
}
