/**
 * The same interface as the live rond.ir client, answered from the local
 * database that `rond:sync` keeps filled with every rond.ir listing. Lets
 * findSimilar() scan all numbers without hitting rond.ir for each estimate.
 */
import { prisma } from "../db";
import { ALGORITHM_BY_ID, ROND_ALGORITHMS } from "../numbers/algorithms";
import { detectPatterns } from "../numbers/patterns";
import type { RondApi, RondItem, RondType } from "./similar";

const BY_KEY = new Map(ROND_ALGORITHMS.map((a) => [a.key, a]));
const toType = (a: { id: string; label: string; priority: number }): RondType => ({ id: a.id, algorithm: a.label, priority: a.priority });

export const localRondApi: RondApi = {
  async search(precode, pattern, typeIds) {
    // pattern is rond.ir's 7-box form: a digit or \d per box
    const regex = `^${precode}${pattern}$`;
    const rows = typeIds.length
      ? await prisma.$queryRaw<{ number: string; price: bigint | null; status: string | null }[]>`
          SELECT "number", "price", "status" FROM "Listing"
          WHERE "active" AND "price" IS NOT NULL AND "number" ~ ${regex} AND "algorithms" @> ${typeIds}::text[]
          LIMIT 500`
      : await prisma.$queryRaw<{ number: string; price: bigint | null; status: string | null }[]>`
          SELECT "number", "price", "status" FROM "Listing"
          WHERE "active" AND "price" IS NOT NULL AND "number" ~ ${regex}
          LIMIT 500`;
    return rows.map((r): RondItem => ({ simCardNumber: r.number, price: r.price == null ? null : Number(r.price), simCardStatus: r.status }));
  },

  async types(full) {
    // rond.ir's own labels when the sync recorded them, else the local detectors
    const row = await prisma.listing.findUnique({ where: { number: full }, select: { algorithms: true } });
    if (row?.algorithms.length) {
      return row.algorithms
        .map((id) => ALGORITHM_BY_ID.get(id))
        .filter((a) => a && a.key !== "ordinary")
        .map((a) => toType(a!));
    }
    return detectPatterns(full.slice(4), full.slice(0, 4))
      .map((t) => BY_KEY.get(t.key))
      .filter((a) => a && a.key !== "ordinary")
      .map((a) => toType(a!));
  },
};

/** Enough synced rond.ir listings for this pre-code to search locally instead of live. */
export async function hasLocalCoverage(precode: string, min = 1000): Promise<boolean> {
  const n = await prisma.listing.count({ where: { prefix: precode, active: true, source: "rond.ir" } });
  return n >= min;
}
