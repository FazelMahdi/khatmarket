import { prisma } from "./db";
import { parseMobile } from "./numbers/normalize";
import { detectPatterns } from "./numbers/patterns";

interface RondItem {
  code?: string;
  simCardNumber?: string;
  price?: number | null;
  simCardStatus?: string | null;
  operator?: { operatorType?: string } | null;
}

/** Accepts a rond.ir page object ({content: [...]}), an array of pages, or a flat array of items. */
function collectItems(json: unknown): RondItem[] {
  if (Array.isArray(json)) return json.flatMap(collectItems);
  if (json && typeof json === "object") {
    const o = json as { content?: unknown };
    if (Array.isArray(o.content)) return o.content as RondItem[];
    if ("simCardNumber" in o || "number" in o) return [json as RondItem];
  }
  return [];
}

export async function importPages(json: unknown, source: string) {
  const items = collectItems(json);
  let upserted = 0;
  let skipped = 0;
  for (const it of items) {
    const raw = it as RondItem & { number?: string; status?: string; operator?: unknown };
    const p = parseMobile(String(it.simCardNumber ?? raw.number ?? ""));
    if (!p) {
      skipped++;
      continue;
    }
    const price = typeof it.price === "number" && it.price > 0 ? BigInt(Math.round(it.price)) : null;
    const operator = typeof raw.operator === "string" ? raw.operator : (it.operator?.operatorType ?? "MCI");
    const data = {
      code: it.code ?? null,
      prefix: p.prefix,
      operator,
      price,
      status: it.simCardStatus ?? raw.status ?? null,
      patternTags: detectPatterns(p.body, p.prefix).map((t) => t.key),
      source,
    };
    await prisma.listing.upsert({ where: { number: p.full }, create: { number: p.full, ...data }, update: data });
    upserted++;
  }
  return { received: items.length, upserted, skipped };
}
