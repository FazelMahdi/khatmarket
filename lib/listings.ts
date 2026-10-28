import { prisma } from "./db";
import type { ListingInput } from "./numbers/estimate";

/** Priced listings for the estimator; prefix-matched rows come first. */
export async function loadListings(prefix: string): Promise<ListingInput[]> {
  const rows = await prisma.listing.findMany({
    where: { price: { not: null } },
    select: { number: true, price: true, status: true, prefix: true },
  });
  rows.sort((a, b) => Number(b.prefix === prefix) - Number(a.prefix === prefix));
  return rows.map((r) => ({ number: r.number, price: r.price == null ? null : Number(r.price), status: r.status }));
}
