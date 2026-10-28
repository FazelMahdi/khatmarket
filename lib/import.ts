import { prisma } from "./db";
import { parseMobile } from "./numbers/normalize";
import { detectPatterns } from "./numbers/patterns";

interface RondItem {
  code?: string;
  simCardNumber?: string;
  number?: string;
  price?: number | null;
  simCardStatus?: string | null;
  status?: string | null;
  advertPriceType?: string | null;
  advertSellType?: string | null;
  advertSpecialType?: string | null;
  operator?: { operatorType?: string } | string | null;
}

/** Accepts a rond.ir page object ({content: [...]}), an array of pages, or a flat array of items. */
export function collectItems(json: unknown): RondItem[] {
  if (Array.isArray(json)) return json.flatMap(collectItems);
  if (json && typeof json === "object") {
    const o = json as { content?: unknown };
    if (Array.isArray(o.content)) return o.content as RondItem[];
    if ("simCardNumber" in o || "number" in o) return [json as RondItem];
  }
  return [];
}

/** Upserts listings; returns the canonical numbers that were stored. */
export async function importItems(items: RondItem[], source: string) {
  const numbers: string[] = [];
  let skipped = 0;
  const ops = [];
  for (const it of items) {
    const p = parseMobile(String(it.simCardNumber ?? it.number ?? ""));
    if (!p) {
      skipped++;
      continue;
    }
    const price = typeof it.price === "number" && it.price > 0 ? BigInt(Math.round(it.price)) : null;
    const operator = typeof it.operator === "string" ? it.operator : (it.operator?.operatorType ?? "MCI");
    const data = {
      code: it.code ?? null,
      prefix: p.prefix,
      operator,
      price,
      status: it.simCardStatus ?? it.status ?? null,
      priceType: it.advertPriceType ?? null,
      sellType: it.advertSellType ?? null,
      special: it.advertSpecialType ?? null,
      patternTags: detectPatterns(p.body, p.prefix).map((t) => t.key),
      source,
    };
    numbers.push(p.full);
    ops.push(prisma.listing.upsert({ where: { number: p.full }, create: { number: p.full, ...data }, update: data }));
  }
  await prisma.$transaction(ops);
  return { received: items.length, upserted: numbers.length, skipped, numbers };
}

export async function importPages(json: unknown, source: string) {
  const { received, upserted, skipped } = await importItems(collectItems(json), source);
  return { received, upserted, skipped };
}

/** Records a rond.ir algorithm label on the given numbers. */
export async function addAlgorithmLabel(algorithmId: string, numbers: string[]) {
  if (numbers.length === 0) return 0;
  return prisma.$executeRaw`
    UPDATE "Listing" SET "algorithms" = array_append("algorithms", ${algorithmId})
    WHERE "number" = ANY(${numbers}) AND NOT (${algorithmId} = ANY("algorithms"))`;
}
