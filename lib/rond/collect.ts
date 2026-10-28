/** Shared crawl logic for `rond:collect` (one-off) and `rond:sync` (hourly worker). */
import { existsSync, readFileSync } from "node:fs";
import { prisma } from "../db";
import { addAlgorithmLabel, importItems } from "../import";
import { ROND_ALGORITHMS } from "../numbers/algorithms";
import { fetchPage, listBody, sleep } from "./client";

export interface CollectOptions {
  precodes: string[];
  size: number;
  /** Base delay between requests in ms (a random 0..delay is added). */
  delay: number;
  /** 0 = all pages */
  maxPages: number;
  /** Page checkpoints; a value of -1 means that query is finished. */
  checkpoint?: { listings: Record<string, number>; labels: Record<string, number> };
  onCheckpoint?: () => void;
  log?: (line: string) => void;
}

/** Walks every page of one query, resuming from `bucket[key]`. */
async function walk(
  opts: CollectOptions,
  label: string,
  body: unknown,
  bucket: Record<string, number>,
  key: string,
  onPage: (items: Record<string, unknown>[]) => Promise<void>,
): Promise<number> {
  let page = bucket[key] ?? 0;
  if (page < 0) {
    opts.log?.(`${label}: done (checkpoint)`);
    return 0;
  }
  let seen = 0;
  for (;;) {
    const res = await fetchPage(body, page, opts.size);
    await onPage(res.content);
    seen += res.content.length;
    const pages = opts.maxPages ? Math.min(res.totalPages, opts.maxPages) : res.totalPages;
    page++;
    bucket[key] = page;
    opts.onCheckpoint?.();
    if (page % 10 === 0 || page >= pages) opts.log?.(`${label}: page ${page}/${pages} (${res.totalElements} listings)`);
    if (res.last || page >= pages || res.content.length === 0) break;
    await sleep(opts.delay + Math.random() * opts.delay);
  }
  bucket[key] = -1;
  opts.onCheckpoint?.();
  return seen;
}

/** Fetches every listing of the given pre-codes. Returns how many were seen per pre-code. */
export async function collectListings(opts: CollectOptions) {
  const cp = opts.checkpoint ?? { listings: {}, labels: {} };
  const seen: Record<string, number> = {};
  for (const pc of opts.precodes) {
    seen[pc] = await walk(opts, `listings ${pc}`, listBody([pc]), cp.listings, pc, async (items) => {
      await importItems(items as never, "rond.ir");
    });
  }
  return seen;
}

/** The request field behind rond.ir's "نوع رند" filter (found by `rond:discover`). */
export function algorithmField(): { field: string; isArray: boolean } | null {
  if (process.env.ROND_ALGO_FIELD) return { field: process.env.ROND_ALGO_FIELD, isArray: true };
  if (!existsSync("data/rond-api.json")) return null;
  const api = JSON.parse(readFileSync("data/rond-api.json", "utf8"));
  return api.algorithmField ? { field: api.algorithmField, isArray: api.algorithmFieldIsArray !== false } : null;
}

/** One filtered pass per algorithm to record rond.ir's own labels. Returns false when no filter field is known. */
export async function collectLabels(opts: CollectOptions): Promise<boolean> {
  const algo = algorithmField();
  if (!algo) return false;
  const cp = opts.checkpoint ?? { listings: {}, labels: {} };
  for (const a of ROND_ALGORITHMS) {
    const value = algo.isArray ? [a.id] : a.id;
    const fresh: string[] = [];
    await walk(opts, `label ${a.label}`, listBody(opts.precodes, { [algo.field]: value }), cp.labels, a.id, async (items) => {
      const { numbers } = await importItems(items as never, "rond.ir");
      fresh.push(...numbers);
      await addAlgorithmLabel(a.id, numbers);
    });
    // A full pass is the truth for this label: drop it from listings that no longer have it.
    if (!opts.maxPages && fresh.length) {
      await prisma.$executeRaw`
        UPDATE "Listing" SET "algorithms" = array_remove("algorithms", ${a.id})
        WHERE ${a.id} = ANY("algorithms") AND "prefix" = ANY(${opts.precodes}) AND NOT ("number" = ANY(${fresh}))`;
    }
  }
  return true;
}

/** After a complete listings pass, listings not seen since `since` are no longer on rond.ir. */
export async function deactivateMissing(precodes: string[], since: Date) {
  const res = await prisma.listing.updateMany({
    where: { source: "rond.ir", prefix: { in: precodes }, lastSeenAt: { lt: since }, active: true },
    data: { active: false },
  });
  return res.count;
}
