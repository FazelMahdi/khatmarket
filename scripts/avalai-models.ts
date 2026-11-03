/**
 * Lists the models your AvalAI key can use, free and cheapest first, and prints
 * an AVALAI_MODELS line for .env.   Usage: npm run avalai:models
 */
import "dotenv/config";

const BASE_URL = (process.env.AVALAI_BASE_URL ?? "https://api.avalai.ir/v1").replace(/\/$/, "");
const CHAT = /gpt|gemini|claude|llama|qwen|deepseek|mistral|grok|gemma|phi/i;
const NOT_CHAT = /embed|whisper|tts|dall|image|audio|moderation|realtime|transcribe|search|veo|imagen/i;

/** Every numeric field whose name looks like a price, found anywhere in the model entry. */
function prices(o: unknown, path = ""): Record<string, number> {
  const out: Record<string, number> = {};
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      const p = path ? `${path}.${k}` : k;
      if (typeof v === "number" && /price|cost|input|output|prompt|completion/i.test(p)) out[p] = v;
      else if (typeof v === "string" && /price|cost/i.test(p) && !isNaN(+v)) out[p] = +v;
      else Object.assign(out, prices(v, p));
    }
  }
  return out;
}

async function main() {
  const key = process.env.AVALAI_API_KEY;
  if (!key) throw new Error("set AVALAI_API_KEY in .env");
  const res = await fetch(`${BASE_URL}/models`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { data?: Record<string, unknown>[] };
  const models = (data.data ?? [])
    .filter((m) => CHAT.test(String(m.id)) && !NOT_CHAT.test(String(m.id)))
    .map((m) => {
      const p = prices(m);
      const values = Object.values(p);
      return { id: String(m.id), prices: p, cost: values.length ? values.reduce((a, b) => a + b, 0) : null, free: /free/i.test(JSON.stringify(m)) };
    })
    .sort((a, b) => Number(b.free) - Number(a.free) || (a.cost ?? Infinity) - (b.cost ?? Infinity) || a.id.localeCompare(b.id));

  for (const m of models) console.log(`${m.free ? "FREE " : "     "}${m.id.padEnd(40)} ${m.cost == null ? "(no price in API)" : JSON.stringify(m.prices)}`);
  const priced = models.filter((m) => m.free || m.cost != null);
  if (priced.length) {
    console.log(`\nsuggested for .env (free first, then cheapest):\nAVALAI_MODELS="${priced.slice(0, 4).map((m) => m.id).join(",")}"`);
  } else {
    console.log("\nThe API lists no prices: pick the free/cheapest ids from https://avalai.ir/pricing and set AVALAI_MODELS in .env");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
