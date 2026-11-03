/**
 * Asks an AvalAI model to price a number the way a person would: look at the
 * closest rond.ir listings found by findSimilar(), pick the real comparables,
 * and suggest a price. The answer is checked against those listings, so a
 * model can't invent numbers or prices out of range.
 */
import { avalaiChat } from "./avalai";

export interface Candidate {
  number: string;
  price: number;
  types: string[];
  /** 0..1 share of rond structure broken */
  lost?: number;
}

export interface AiPrice {
  model: string;
  price: { low: number; mid: number; high: number };
  comparables: string[];
  reason: string;
}

const cache = new Map<string, { at: number; value: AiPrice }>();
const CACHE_MS = 60 * 60_000;

const SYSTEM = `You price Iranian mobile SIM numbers ("رند" numbers) from real asking prices on rond.ir.
Value comes from the 7 digits after the pre-code: repeated digits, runs (1234), zeros, mirrors, pairs, and how early they appear.
Rules:
- Use ONLY the candidate listings given. Pick the 1-5 whose rond structure is closest to the query (same kind and strength of pattern, not merely similar digits).
- A candidate with a clearly stronger or weaker pattern is not a comparable.
- Base the price on the chosen comparables' prices (toman). Do not invent listings.
- Answer with JSON only: {"comparables":["09..."],"low":int,"mid":int,"high":int,"reason":"<one or two short sentences in Persian>"}`;

function parseJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

const round = (n: number) => {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
};

/** Validates a model answer against the candidates; null when it doesn't hold up. */
export function checkAnswer(raw: Record<string, unknown> | null, candidates: Candidate[]): Omit<AiPrice, "model"> | null {
  if (!raw) return null;
  const byNumber = new Map(candidates.map((c) => [c.number, c]));
  const comparables = (Array.isArray(raw.comparables) ? raw.comparables : [])
    .map(String)
    .filter((n) => byNumber.has(n))
    .slice(0, 5);
  const nums = [raw.low, raw.mid, raw.high].map(Number);
  if (!comparables.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const [low, mid, high] = [...nums].sort((a, b) => a - b);
  // The suggested price has to sit near what the chosen comparables actually ask.
  const prices = comparables.map((n) => byNumber.get(n)!.price);
  if (mid < Math.min(...prices) / 2 || mid > Math.max(...prices) * 2) return null;
  return {
    price: { low: round(low), mid: round(mid), high: round(high) },
    comparables,
    reason: String(raw.reason ?? "").slice(0, 400),
  };
}

export async function aiPrice(number: string, types: string[], scanned: number, candidates: Candidate[]): Promise<AiPrice | null> {
  if (!candidates.length) return null;
  const hit = cache.get(number);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const list = candidates
    .slice(0, 30)
    .map((c) => `${c.number} | ${c.price} | ${c.types.join("، ") || "معمولی"}${c.lost != null ? ` | lost=${c.lost.toFixed(2)}` : ""}`)
    .join("\n");
  const user = `Query: ${number}
Query rond types: ${types.join("، ") || "معمولی"}
These are the ${Math.min(30, candidates.length)} closest of ${scanned} priced rond.ir listings compared, best first.
Candidates (number | asking price in toman | rond types | lost = share of the query's structure the candidate breaks, 0 is identical):
${list}`;

  const { model, content } = await avalaiChat([
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ]);
  const checked = checkAnswer(parseJson(content), candidates);
  if (!checked) throw new Error(`AvalAI ${model}: answer did not match the candidates`);
  const value = { model, ...checked };
  cache.set(number, { at: Date.now(), value });
  return value;
}
