import { prisma } from "./db";
import type { ListingInput } from "./numbers/estimate";

const TTL = 5 * 60 * 1000;
let cache: { at: number; rows: ListingInput[] } | null = null;

/** All priced listings (cached for a few minutes; ~50k rows per pre-code). */
export async function loadListings(): Promise<ListingInput[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;
  const rows = await prisma.listing.findMany({
    where: { price: { not: null } },
    select: { number: true, price: true, status: true },
  });
  cache = { at: Date.now(), rows: rows.map((r) => ({ number: r.number, price: Number(r.price), status: r.status })) };
  return cache.rows;
}

export function invalidateListings() {
  cache = null;
}
