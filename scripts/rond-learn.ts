/**
 * Learns from the collected rond.ir data:
 *  1. how well each pattern detector agrees with rond.ir's own "نوع رند" labels,
 *  2. price factors per pre-code and per SIM status  -> data/model.json,
 *  3. a backtest: price held-out listings from the rest -> median error.
 * Usage: npm run rond:learn  [-- --backtest=400]
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../lib/db";
import { ROND_ALGORITHMS } from "../lib/numbers/algorithms";
import { estimatePrice, type ListingInput, type PriceModel } from "../lib/numbers/estimate";
import { detectPatterns } from "../lib/numbers/patterns";

const backtestN = Number(process.argv.find((a) => a.startsWith("--backtest="))?.split("=")[1] ?? 400);

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const rows = await prisma.listing.findMany({
    select: { number: true, prefix: true, price: true, status: true, algorithms: true },
  });
  const labelled = rows.filter((r) => r.algorithms.length > 0);
  console.log(`listings: ${rows.length}, priced: ${rows.filter((r) => r.price).length}, labelled: ${labelled.length}`);

  // 1. Detector vs rond.ir labels
  const detectors: Record<string, unknown>[] = [];
  if (labelled.length) {
    console.log("\nalgorithm                     labelled  precision  recall");
    for (const a of ROND_ALGORITHMS) {
      let tp = 0, fp = 0, fn = 0;
      const falsePos: string[] = [];
      const falseNeg: string[] = [];
      for (const r of labelled) {
        const truth = r.algorithms.includes(a.id);
        const pred = detectPatterns(r.number.slice(4), r.prefix).some((t) => t.key === a.key);
        if (truth && pred) tp++;
        else if (pred) {
          fp++;
          if (falsePos.length < 25) falsePos.push(r.number);
        } else if (truth) {
          fn++;
          if (falseNeg.length < 25) falseNeg.push(r.number);
        }
      }
      const precision = tp + fp ? tp / (tp + fp) : 0;
      const recall = tp + fn ? tp / (tp + fn) : 0;
      detectors.push({ id: a.id, key: a.key, label: a.label, labelled: tp + fn, precision, recall, falsePos, falseNeg });
      console.log(`${a.label.padEnd(28)} ${String(tp + fn).padStart(8)}  ${pct(precision).padStart(9)}  ${pct(recall).padStart(6)}`);
    }
  } else {
    console.log("no rond.ir labels yet (run the collector's label pass) - skipping detector check");
  }

  // 2. Price factors. Compare like with like: same primary pattern, different pre-code / status.
  const priced = rows.filter((r) => r.price != null && Number(r.price) > 0);
  const groupKey = (r: (typeof priced)[number]) => {
    const primary = r.algorithms.length
      ? ROND_ALGORITHMS.filter((a) => r.algorithms.includes(a.id)).sort((x, y) => x.priority - y.priority)[0]?.key
      : detectPatterns(r.number.slice(4), r.prefix)[0].key;
    return primary ?? "ordinary";
  };
  const byGroup = new Map<string, typeof priced>();
  for (const r of priced) {
    const k = groupKey(r);
    byGroup.set(k, [...(byGroup.get(k) ?? []), r]);
  }
  const ratiosFor = (field: "prefix" | "status", ref: string) => {
    const acc = new Map<string, number[]>();
    for (const list of byGroup.values()) {
      const refPrices = list.filter((r) => r[field] === ref).map((r) => Number(r.price));
      if (refPrices.length < 5) continue;
      const refMed = median(refPrices);
      const vals = new Map<string, number[]>();
      for (const r of list) {
        const v = r[field];
        if (!v || v === ref) continue;
        vals.set(v, [...(vals.get(v) ?? []), Number(r.price)]);
      }
      for (const [v, ps] of vals) if (ps.length >= 5) acc.set(v, [...(acc.get(v) ?? []), median(ps) / refMed]);
    }
    return Object.fromEntries([[ref, 1], ...[...acc].map(([v, rs]) => [v, +median(rs).toFixed(3)])]);
  };
  const model: PriceModel = {
    precodeFactor: ratiosFor("prefix", "0912"),
    statusFactor: ratiosFor("status", "LIKE_NEW"),
    minMatches: priced.length >= 2000 ? 5 : 2,
  };
  console.log("\npre-code factors (vs 0912):", model.precodeFactor);
  console.log("status factors (vs LIKE_NEW):", model.statusFactor);

  // 3. Backtest on a random sample: estimate each listing without itself (--backtest=0 skips it).
  const all: ListingInput[] = (backtestN > 0 ? priced : []).map((r) => ({ number: r.number, price: Number(r.price), status: r.status }));
  const sample = [...all].sort(() => Math.random() - 0.5).slice(0, backtestN);
  const errors: number[] = [];
  const byMethod: Record<string, number[]> = {};
  let i = 0;
  for (const s of sample) {
    const rest = all.filter((l) => l.number !== s.number);
    const e = estimatePrice(s.number, rest, model);
    if (e?.price) {
      const err = Math.abs(e.price.mid - s.price!) / s.price!;
      errors.push(err);
      (byMethod[e.method] ??= []).push(err);
    }
    if (++i % 50 === 0) process.stdout.write(`\rbacktest ${i}/${sample.length}`);
  }
  const summary = {
    n: errors.length,
    medianAbsPctError: median(errors),
    within30pct: errors.filter((e) => e <= 0.3).length / (errors.length || 1),
    byMethod: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, { n: v.length, medianAbsPctError: median(v) }])),
  };
  if (backtestN > 0) console.log(`\nbacktest: median error ${pct(summary.medianAbsPctError)}, within ±30%: ${pct(summary.within30pct)}`, summary.byMethod);

  writeFileSync("data/model.json", JSON.stringify(model, null, 2));
  writeFileSync("data/learn-report.json", JSON.stringify({ at: new Date().toISOString(), counts: { listings: rows.length, priced: priced.length, labelled: labelled.length }, detectors, model, backtest: summary }, null, 2));
  console.log("written data/model.json and data/learn-report.json");
}

main().finally(() => prisma.$disconnect());
