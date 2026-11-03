/** Prices one number from the command line, same path as the site.   npm run estimate -- 09121003088 */
import "dotenv/config";
import { aiPrice } from "../lib/ai/pricer";
import { avalaiEnabled } from "../lib/ai/avalai";
import { prisma } from "../lib/db";
import { parseMobile } from "../lib/numbers/normalize";
import { detectPatterns } from "../lib/numbers/patterns";
import { rondApi } from "../lib/rond/client";
import { hasLocalCoverage, localRondApi } from "../lib/rond/local-api";
import { findSimilar } from "../lib/rond/similar";

async function main() {
  const p = parseMobile(process.argv[2] ?? "09121003088");
  if (!p) throw new Error("invalid number");
  const local = await hasLocalCoverage(p.prefix);
  console.log(`${p.full}: searching ${local ? "local copy of rond.ir" : "rond.ir live"}...`);
  const found = await findSimilar(p.full, local ? localRondApi : rondApi);
  console.log("types:", found.types.map((t) => t.algorithm).join("، ") || "معمولی");
  for (const m of found.matches.slice(0, 10)) console.log(`  ${m.number}  ${m.price.toLocaleString()}  lost=${m.lost.toFixed(2)}  ${(m.types ?? []).join("، ")}`);
  console.log("algorithmic price:", found.price, found.confidence, `(${found.queries} queries)`);
  if (avalaiEnabled()) {
    const typesOf = (n: string, t?: string[]) => t ?? detectPatterns(n.slice(4), n.slice(0, 4)).map((x) => x.label);
    const ai = await aiPrice(p.full, found.types.map((t) => t.algorithm), found.matches.slice(0, 20).map((m) => ({ number: m.number, price: m.price, types: typesOf(m.number, m.types), lost: m.lost })));
    console.log("AvalAI:", ai);
  } else console.log("AvalAI: AVALAI_API_KEY not set");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
