/**
 * Collects rond.ir listings into the local database, then labels them with
 * rond.ir's own "نوع رند" algorithms (one filtered pass per algorithm).
 *
 * Usage:
 *   npm run rond:collect                       # all MCI pre-codes, listings + labels
 *   npm run rond:collect -- --precodes=0912    # one pre-code
 *   npm run rond:collect -- --no-labels        # listings only
 * Options: --size=100 --delay=400 --max-pages=0 (0 = all) --fresh (ignore checkpoint)
 * For the hourly version see `npm run rond:sync`.
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/db";
import { MCI_PRECODES } from "../lib/numbers/algorithms";
import { collectLabels, collectListings } from "../lib/rond/collect";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const STATE_FILE = "data/collect-state.json";
const checkpoint =
  !args.fresh && existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : { listings: {}, labels: {} };

const opts = {
  precodes: args.precodes ? String(args.precodes).split(",") : MCI_PRECODES,
  size: Number(args.size ?? 100),
  delay: Number(args.delay ?? 400),
  maxPages: Number(args["max-pages"] ?? 0),
  checkpoint,
  onCheckpoint: () => writeFileSync(STATE_FILE, JSON.stringify(checkpoint, null, 2)),
  log: (line: string) => console.log(line),
};

async function main() {
  console.log(`pre-codes: ${opts.precodes.join(", ")} | page size ${opts.size} | delay ~${opts.delay}ms`);
  await collectListings(opts);
  if (args.labels === "false" || args["no-labels"]) return;
  if (!(await collectLabels(opts))) {
    console.warn("No algorithm filter field known: run `npm run rond:discover` first (or set ROND_ALGO_FIELD). Skipping labels.");
  }
}

main()
  .then(async () => {
    const [total, priced, labelled] = await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { price: { not: null } } }),
      prisma.listing.count({ where: { NOT: { algorithms: { isEmpty: true } } } }),
    ]);
    console.log(`database: ${total} listings, ${priced} priced, ${labelled} labelled`);
  })
  .catch((e) => {
    console.error("\n", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
