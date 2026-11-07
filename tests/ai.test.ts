import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAnswer, type Candidate } from "../lib/ai/pricer";

const candidates: Candidate[] = [
  { number: "09121003188", price: 900_000_000, types: ["کد پایین"] },
  { number: "09121003077", price: 1_100_000_000, types: ["کد پایین"] },
  { number: "09122002022", price: 18_000_000_000, types: ["متشکل از دو رقم"] },
];

describe("checkAnswer", () => {
  it("accepts comparables from the list and a price near theirs", () => {
    const r = checkAnswer({ comparables: ["09121003188", "09121003077"], low: 850e6, mid: 1e9, high: 1.2e9, reason: "x" }, candidates);
    expect(r?.price.mid).toBe(1_000_000_000);
    expect(r?.comparables).toEqual(["09121003188", "09121003077"]);
  });
  it("drops invented numbers", () => {
    expect(checkAnswer({ comparables: ["09120000000"], low: 1, mid: 1e9, high: 2e9 }, candidates)).toBeNull();
  });
  it("rejects a price far from the chosen comparables", () => {
    expect(checkAnswer({ comparables: ["09121003188"], low: 5e9, mid: 9e9, high: 1e10 }, candidates)).toBeNull();
  });
  it("orders low/mid/high", () => {
    const r = checkAnswer({ comparables: ["09121003188"], low: 1.2e9, mid: 9e8, high: 8e8 }, candidates);
    expect(r?.price).toEqual({ low: 800_000_000, mid: 900_000_000, high: 1_200_000_000 });
  });
});

describe("avalaiChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("falls through to the next model when one fails", async () => {
    vi.stubEnv("AVALAI_API_KEY", "test");
    vi.stubEnv("AVALAI_MODELS", "free-model,cheap-model");
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const { model } = JSON.parse(String(init.body));
      seen.push(model);
      if (model === "free-model") return new Response("quota", { status: 429 });
      return Response.json({ choices: [{ message: { content: "{}" } }] });
    });
    const { avalaiChat } = await import("../lib/ai/avalai");
    const r = await avalaiChat([{ role: "user", content: "hi" }]);
    expect(seen).toEqual(["free-model", "cheap-model"]);
    expect(r.model).toBe("cheap-model");
  });

  it("retries with higher max_tokens when reasoning ate the budget", async () => {
    vi.stubEnv("AVALAI_API_KEY", "test");
    vi.stubEnv("AVALAI_MODELS", "gpt-6-luna");
    const maxTokensSeen: number[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { max_tokens: number };
      maxTokensSeen.push(body.max_tokens);
      if (body.max_tokens < 8000) {
        return Response.json({
          choices: [{ message: { content: "" } }],
          usage: { completion_tokens_details: { reasoning_tokens: 500 } },
        });
      }
      return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
    });
    const { avalaiChat } = await import("../lib/ai/avalai");
    const r = await avalaiChat([{ role: "user", content: "hi" }], { maxTokens: 4000 });
    expect(maxTokensSeen).toEqual([4000, 8000]);
    expect(r.content).toBe('{"ok":true}');
  });
});
