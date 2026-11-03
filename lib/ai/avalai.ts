/**
 * AvalAI (avalai.ir) chat client. The API is OpenAI-compatible.
 * Models are tried in the order of AVALAI_MODELS (free ones first, then the
 * cheapest; see `npm run avalai:models`); a model that fails is skipped for a while.
 */

const BASE_URL = (process.env.AVALAI_BASE_URL ?? "https://api.avalai.ir/v1").replace(/\/$/, "");
// Small, inexpensive models only. Replace with the free ones `npm run avalai:models` lists.
const DEFAULT_MODELS = ["gpt-4.1-nano", "gemini-2.0-flash-lite", "gpt-4o-mini"];
const COOLDOWN_MS = 10 * 60_000;
const failedUntil = new Map<string, number>();

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const avalaiEnabled = () => !!process.env.AVALAI_API_KEY;

export function avalaiModels(): string[] {
  const list = process.env.AVALAI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return list?.length ? list : DEFAULT_MODELS;
}

export async function avalaiChat(messages: ChatMessage[], opts: { maxTokens?: number } = {}) {
  const key = process.env.AVALAI_API_KEY;
  if (!key) throw new Error("AVALAI_API_KEY is not set");
  const errors: string[] = [];
  for (const model of avalaiModels()) {
    if ((failedUntil.get(model) ?? 0) > Date.now()) continue;
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: opts.maxTokens ?? 500 }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty answer");
      return { model, content, usage: data.usage };
    } catch (e) {
      failedUntil.set(model, Date.now() + COOLDOWN_MS);
      errors.push(`${model}: ${(e as Error).message}`);
    }
  }
  throw new Error(`AvalAI: no model answered (${errors.join(" | ") || "all models cooling down"})`);
}
