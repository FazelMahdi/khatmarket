/**
 * Collects rond.ir listings into the local database, then labels them with
 * rond.ir's own "نوع رند" algorithms (one filtered pass per algorithm).
 *
 * Usage:
 *   npm run rond:collect                       # all MCI pre-codes, listings + labels
 *   npm run rond:collect -- --precodes=0912    # one pre-code
 *   npm run rond:collect -- --no-labels        # listings only
 * Options: --size=100 --delay=400 --max-pages=0 (0 = all) --fresh (ignore checkpoint)
 * Needs data/rond-api.json from `npm run rond:discover` for the label pass
 * (or ROND_ALGO_FIELD=<field name>).
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/db";
import { addAlgorithmLabel, importItems } from "../lib/import";
import { MCI_PRECODES, ROND_ALGORITHMS } from "../lib/numbers/algorithms";
import { fetchPage, listBody, sleep } from "../lib/rond/client";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const precodes = args.precodes ? String(args.precodes).split(",") : MCI_PRECODES;
const size = Number(args.size ?? 100);
const delay = Number(args.delay ?? 400);
const maxPages = Number(args["max-pages"] ?? 0);
const STATE_FILE = "data/collect-state.json";

type State = { listings: Record<string, number>; labels: Record<string, number> };
const state: State =
  !args.fresh && existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : { listings: {}, labels: {} };
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

/** Walks every page of one query; `onPage` stores the items. Resumes from `key` in the checkpoint. */
async function walk(
  label: string,
  body: unknown,
  bucket: Record<string, number>,
  key: string,
  onPage: (items: Record<string, unknown>[]) => Promise<void>,
) {
  let page = bucket[key] ?? 0;
  if (page < 0) return console.log(`${label}: done (checkpoint)`);
  for (;;) {
    const res = await fetchPage(body, page, size);
    await onPage(res.content);
    const pages = maxPages ? Math.min(res.totalPages, maxPages) : res.totalPages;
    process.stdout.write(`\r${label}: page ${page + 1}/${pages} (${res.totalElements} listings)   `);
    page++;
    bucket[key] = page;
    save();
    if (res.last || page >= pages || res.content.length === 0) break;
    await sleep(delay + Math.random() * delay);
  }
  bucket[key] = -1;
  save();
  process.stdout.write("\n");
}

function algorithmField(): { field: string; isArray: boolean } | null {
  if (process.env.ROND_ALGO_FIELD) return { field: process.env.ROND_ALGO_FIELD, isArray: true };
  if (!existsSync("data/rond-api.json")) return null;
  const api = JSON.parse(readFileSync("data/rond-api.json", "utf8"));
  return api.algorithmField ? { field: api.algorithmField, isArray: api.algorithmFieldIsArray !== false } : null;
}

async function main() {
  console.log(`pre-codes: ${precodes.join(", ")} | page size ${size} | delay ~${delay}ms`);
  for (const pc of precodes) {
    await walk(`listings ${pc}`, listBody([pc]), state.listings, pc, async (items) => {
      await importItems(items as never, "rond.ir");
    });
  }

  if (args.labels === "false" || args["no-labels"]) return;
  const algo = algorithmField();
  if (!algo) {
    console.warn("No algorithm filter field known: run `npm run rond:discover` first (or set ROND_ALGO_FIELD). Skipping labels.");
    return;
  }
  console.log(`labelling with field "${algo.field}"`);
  for (const a of ROND_ALGORITHMS) {
    const value = algo.isArray ? [a.id] : a.id;
    await walk(`label ${a.label}`, listBody(precodes, { [algo.field]: value }), state.labels, a.id, async (items) => {
      const { numbers } = await importItems(items as never, "rond.ir");
      await addAlgorithmLabel(a.id, numbers);
    });
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
