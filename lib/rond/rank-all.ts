/**
 * Ranks every synced rond.ir listing against a number: the same scoring as the
 * live search (lib/rond/similar.ts), but over all listings instead of the few
 * that a handful of digit-box searches return. Uses rond.ir's own type labels
 * that rond:sync stored on each listing.
 */
import { prisma } from "../db";
import { ALGORITHM_BY_ID } from "../numbers/algorithms";
import { levelRatio, levelsFrom, snapshotLevels, type Levels } from "./levels";
import { jaccard, measure, priceFrom, rank, type SimilarListing, type SimilarResult, type RondType } from "./similar";

interface Row {
  number: string;
  price: number;
  status: string | null;
  types: string[];
}

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; rows: Row[] }>();
const levelsCache = new WeakMap<Row[], Levels>();

const labels = (ids: string[]) =>
  ids.map((id) => ALGORITHM_BY_ID.get(id)).filter((a) => a && a.key !== "ordinary").map((a) => a!.label);

/** Every active priced listing of a pre-code (cached a few minutes; ~50k rows for 0912). */
export async function listingsOf(prefix: string): Promise<Row[]> {
  const hit = cache.get(prefix);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  const rows = await prisma.listing.findMany({
    where: { prefix, active: true, price: { not: null } },
    select: { number: true, price: true, status: true, algorithms: true },
  });
  const out = rows.map((r) => ({ number: r.number, price: Number(r.price), status: r.status, types: labels(r.algorithms) }));
  cache.set(prefix, { at: Date.now(), rows: out });
  return out;
}

export interface RankAllResult extends SimilarResult {
  /** how many listings were compared */
  scanned: number;
}

export function rankAll(full: string, rows: Row[], types: RondType[]): Omit<RankAllResult, "queries"> {
  const body = full.slice(4);
  // Code-block levels from the same listings once a full pre-code is synced, so they follow
  // today's market; a partial sync can't fill ~1000 blocks, so the 0912 snapshot covers it.
  let levels = levelsCache.get(rows);
  if (!levels) {
    levels = rows.length >= 10_000 ? levelsFrom(rows) : (snapshotLevels(full.slice(0, 4)) ?? levelsFrom(rows));
    levelsCache.set(rows, levels);
  }
  const qTypes = types.map((t) => t.algorithm);
  const matches: SimilarListing[] = [];
  for (const r of rows) {
    const b = r.number.slice(4);
    const m: SimilarListing = { number: r.number, price: r.price, status: r.status, ...measure(body, b), ratio: levelRatio(levels, body, b) };
    // Unlabelled listings stay neutral (0.5), as in the live search.
    if (r.types.length || qTypes.length === 0) {
      m.types = r.types;
      m.typeMatch = jaccard(qTypes, r.types);
    }
    matches.push(m);
  }
  matches.sort(rank);
  return { types, matches, scanned: rows.length, ...priceFrom(full, matches) };
}
