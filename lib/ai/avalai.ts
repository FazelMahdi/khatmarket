/**
 * AvalAI (avalai.ir) chat client. The API is OpenAI-compatible.
 * Models are tried in the order of AVALAI_MODELS (free ones first, then the
 * cheapest; see `npm run avalai:models`); a model that fails is skipped for a while.
 *
 * Reasoning models (e.g. gpt-6-luna) spend completion tokens on reasoning first.
 * Without a large enough max_tokens, `content` comes back empty — we default high
 * and retry once when usage shows reasoning_tokens ate the budget.
 */

import { getSetting } from "../settings";

const BASE_URL = (process.env.AVALAI_BASE_URL ?? "https://api.avalai.ir/v1").replace(/\/$/, "");
// Small, inexpensive models only. Replace with the free ones `npm run avalai:models` lists.
const DEFAULT_MODELS = ["gpt-4.1-nano", "gemini-2.0-flash-lite", "gpt-4o-mini"];
/** High enough for reasoning models so visible content is not empty. */
const DEFAULT_MAX_TOKENS = 4000;
const REASONING_RETRY_TOKENS = 8000;
const COOLDOWN_MS = 10 * 60_000;
const failedUntil = new Map<string, number>();

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type ChatCompletion = {
  choices?: { message?: { content?: string } }[];
  usage?: {
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
};

/** Key and models come from the admin panel, else .env. */
export const avalaiEnabled = async () => !!(await getSetting("AVALAI_API_KEY"));

export async function avalaiModels(): Promise<string[]> {
  const list = (await getSetting("AVALAI_MODELS"))?.split(",").map((m) => m.trim()).filter(Boolean);
  return list?.length ? list : DEFAULT_MODELS;
}

/** Lists the models the key can use (also checks the key works). */
export async function avalaiListModels(): Promise<string[]> {
  const key = await getSetting("AVALAI_API_KEY");
  if (!key) throw new Error("AVALAI_API_KEY is not set");
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id);
}

async function completeOnce(
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<{ content: string; usage: ChatCompletion["usage"] }> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as ChatCompletion;
  if (data.error?.message) throw new Error(data.error.message);

  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (content) return { content, usage: data.usage };

  const reasoning = data.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  if (reasoning > 0) {
    throw new Error(`empty answer (reasoning_tokens=${reasoning}, max_tokens=${maxTokens})`);
  }
  throw new Error("empty answer");
}

export async function avalaiChat(messages: ChatMessage[], opts: { maxTokens?: number } = {}) {
  const key = await getSetting("AVALAI_API_KEY");
  if (!key) throw new Error("AVALAI_API_KEY is not set");
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const errors: string[] = [];

  for (const model of await avalaiModels()) {
    if ((failedUntil.get(model) ?? 0) > Date.now()) continue;
    try {
      try {
        const first = await completeOnce(key, model, messages, maxTokens);
        return { model, content: first.content, usage: first.usage };
      } catch (e) {
        const msg = (e as Error).message;
        // Reasoning model burned the budget — one retry with more room for content.
        if (msg.includes("reasoning_tokens=") && maxTokens < REASONING_RETRY_TOKENS) {
          const second = await completeOnce(key, model, messages, REASONING_RETRY_TOKENS);
          return { model, content: second.content, usage: second.usage };
        }
        throw e;
      }
    } catch (e) {
      failedUntil.set(model, Date.now() + COOLDOWN_MS);
      errors.push(`${model}: ${(e as Error).message}`);
    }
  }
  throw new Error(`AvalAI: no model answered (${errors.join(" | ") || "all models cooling down"})`);
}
