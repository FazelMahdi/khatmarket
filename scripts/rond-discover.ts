/**
 * Reads rond.ir's own front-end code to find its API endpoints and the request
 * fields behind each filter (digit boxes, "نوع رند", price, ...).
 * Usage: npm run rond:discover            -> writes data/rond-api.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE_URL, headers, listBody, fetchPage } from "../lib/rond/client";
import { ROND_ALGORITHMS } from "../lib/numbers/algorithms";

const START_PAGES = ["/", "/SimLanding/Mci/0912"];
const MAX_FILES = 400;

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: headers({ accept: "*/*" }) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const abs = (u: string, from: string) => {
  try {
    return new URL(u, from).toString();
  } catch {
    return null;
  }
};

async function main() {
  const seen = new Set<string>();
  const queue: string[] = START_PAGES.map((p) => BASE_URL + p);
  const sources: { url: string; text: string }[] = [];

  while (queue.length && seen.size < MAX_FILES) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const text = await get(url);
    if (!text) continue;
    sources.push({ url, text });
    // Scripts from HTML and chunk references inside JS (same origin only).
    const refs = [
      ...text.matchAll(/<script[^>]+src=["']([^"']+)["']/g),
      ...text.matchAll(/["'`]((?:\/|\.\/|https?:\/\/[^"'`]*rond\.ir\/)[^"'`\s]*?\.js)["'`]/g),
      ...text.matchAll(/["'`](static\/[^"'`\s]+?\.js)["'`]/g),
    ].map((m) => m[1]);
    for (const r of refs) {
      const u = abs(r.startsWith("static/") ? "/_next/" + r : r, url);
      if (u && u.startsWith(BASE_URL) && !seen.has(u)) queue.push(u);
    }
  }
  console.log(`fetched ${sources.length} files from ${BASE_URL}`);

  const apiPaths = new Set<string>();
  const keyCounts = new Map<string, number>();
  const contexts: { file: string; snippet: string }[] = [];
  const ANCHORS = ["operatorIdIn", "simCardNumberPreCodes", "searchReference", "algorithm"];

  for (const { url, text } of sources) {
    for (const m of text.matchAll(/["'`](\/?api\/ns\/[A-Za-z0-9_\-\/{}$.]+)["'`]/g)) apiPaths.add(m[1]);
    for (const m of text.matchAll(/["'`](\/[a-z\-]+(?:\/[A-Za-z0-9_\-]+)*\/(?:page|list|search|all|find)[A-Za-z\-]*)["'`]/g)) apiPaths.add(m[1]);
    for (const a of ANCHORS) {
      let idx = text.indexOf(a);
      let n = 0;
      while (idx >= 0 && n < 20) {
        const win = text.slice(Math.max(0, idx - 1500), idx + 1500);
        for (const k of win.matchAll(/[{,]\s*["']?([A-Za-z_$][\w$]{2,40})["']?\s*:/g)) {
          keyCounts.set(k[1], (keyCounts.get(k[1]) ?? 0) + 1);
        }
        if (contexts.length < 60) contexts.push({ file: url, snippet: text.slice(Math.max(0, idx - 400), idx + 400) });
        idx = text.indexOf(a, idx + a.length);
        n++;
      }
    }
  }

  const keys = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const interesting = keys.filter((k) => /algorithm|pattern|digit|number|price|status|type|code|special|sell|from|to|In$|Ids?$/i.test(k));
  const GUESSES = ["algorithmIdIn", "algorithmIds", "algorithmIn", "simCardAlgorithmIdIn", "simCardNumberAlgorithmIdIn", "algorithms"];
  const algorithmCandidates = [...new Set([...keys.filter((k) => /algorithm/i.test(k)), ...GUESSES])];
  const digitCandidates = keys.filter((k) => /digit|pattern|simCardNumber(?!PreCodes)|number(?!Of)/i.test(k));

  // Try each algorithm-field candidate on the live API: a real filter shrinks the result.
  const base = await fetchPage(listBody(["0912"]), 0, 1);
  const verified: Record<string, { value: unknown; total: number }> = {};
  const probe = ROND_ALGORITHMS.find((a) => a.key === "seven_same")!;
  for (const field of algorithmCandidates) {
    for (const value of [[probe.id], probe.id]) {
      try {
        const r = await fetchPage(listBody(["0912"], { [field]: value }), 0, 1);
        if (r.totalElements < base.totalElements) {
          verified[field] = { value: Array.isArray(value) ? "array" : "string", total: r.totalElements };
          break;
        }
      } catch {
        /* field rejected */
      }
    }
  }
  const algorithmField = Object.keys(verified)[0] ?? null;

  const out = {
    baseUrl: BASE_URL,
    discoveredAt: new Date().toISOString(),
    filesScanned: sources.length,
    totalListings0912: base.totalElements,
    apiPaths: [...apiPaths].sort(),
    requestKeys: interesting,
    algorithmCandidates,
    digitCandidates,
    algorithmField,
    algorithmFieldIsArray: algorithmField ? verified[algorithmField].value === "array" : null,
    verified,
    contexts,
  };
  mkdirSync("data", { recursive: true });
  writeFileSync("data/rond-api.json", JSON.stringify(out, null, 2));

  console.log("API paths:", out.apiPaths.slice(0, 30));
  console.log("request keys:", interesting.slice(0, 40).join(", "));
  console.log("algorithm field:", algorithmField ?? "NOT FOUND", verified);
  console.log("listings for 0912:", base.totalElements);
  console.log("written data/rond-api.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
