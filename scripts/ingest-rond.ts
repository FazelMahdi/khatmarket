/**
 * Pulls priced listings from rond.ir into the database.
 * Usage: ROND_COOKIE="..." npx tsx scripts/ingest-rond.ts 0912 [maxPages]
 * Needs network access to rond.ir; the cookie is only read from the environment.
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { importPages } from "../lib/import";

const MCI = "65cb3414c8133a36e6f8708f";
const precode = process.argv[2] ?? "0912";
const maxPages = Number(process.argv[3] ?? 50);

async function main() {
  for (let page = 0; page < maxPages; page++) {
    const url = `https://rond.ir/api/ns/sim-card/web/sim-card-advert/page?page=${page}&size=40&sort=advertSpecialType,desc&sort=lastUpdateDateMillis,desc&sort=createDateMillis,desc`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://rond.ir",
        referer: `https://rond.ir/SimLanding/Mci/${precode}`,
        skip: "true",
        ...(process.env.ROND_COOKIE ? { cookie: process.env.ROND_COOKIE } : {}),
      },
      body: JSON.stringify({ operatorIdIn: [MCI], searchReference: "SEARCH", simCardNumberPreCodes: [precode], hasShop: null }),
    });
    if (!res.ok) throw new Error(`rond.ir responded ${res.status} on page ${page}`);
    const data = await res.json();
    console.log(`page ${page + 1}/${data.totalPages}`, await importPages(data, "rond.ir"));
    if (data.last) break;
    await new Promise((r) => setTimeout(r, 400));
  }
}

main().finally(() => prisma.$disconnect());
