/** Minimal rond.ir API client used by the collector scripts (runs on the user's machine). */
import { MCI_OPERATOR_ID } from "../numbers/algorithms";
import type { RondApi, RondItem, RondType } from "./similar";

export const BASE_URL = (process.env.ROND_BASE_URL ?? "https://rond.ir").replace(/\/$/, "");
const LIST_PATH = "/api/ns/sim-card/web/sim-card-advert/page";
const SORT = "sort=advertSpecialType,desc&sort=lastUpdateDateMillis,desc&sort=createDateMillis,desc";

export interface RondPage {
  content: Record<string, unknown>[];
  totalPages: number;
  totalElements: number;
  last: boolean;
  number: number;
  size: number;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: BASE_URL,
    referer: `${BASE_URL}/`,
    skip: "true",
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    ...(process.env.ROND_COOKIE ? { cookie: process.env.ROND_COOKIE } : {}),
    ...extra,
  };
}

export function listBody(precodes: string[], extra: Record<string, unknown> = {}) {
  return { operatorIdIn: [MCI_OPERATOR_ID], searchReference: "SEARCH", simCardNumberPreCodes: precodes, hasShop: null, ...extra };
}

/** Live access for lib/rond/similar.ts: digit-box search (any operator) and rond.ir's own type of a number. */
export const rondApi: RondApi = {
  async search(precode, pattern, typeIds) {
    const body = {
      searchReference: "SEARCH",
      simCardNumberPreCodes: [precode],
      // like the site, no pattern when every box is blank
      simCardNumberWithoutPreCodePattern: pattern.replace(/\\d/g, "") ? pattern : undefined,
      ...(typeIds.length ? { rondTypeIds: typeIds } : {}),
      hasShop: null,
    };
    return (await fetchPage(body, 0, 500)).content as unknown as RondItem[];
  },
  async types(full) {
    const res = await fetch(`${BASE_URL}/api/ns/sim-card/rond-bot?mobileNumber=${full}`, { headers: headers() });
    if (!res.headers.get("content-type")?.includes("json")) throw new Error(`rond-bot HTTP ${res.status}: set ROND_COOKIE`);
    return (await res.json()) as RondType[];
  },
};

/** POST one listing page, retrying transient failures with backoff. */
export async function fetchPage(body: unknown, page: number, size: number): Promise<RondPage> {
  const url = `${BASE_URL}${LIST_PATH}?page=${page}&size=${size}&${SORT}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`), { fatal: true });
      // ArvanCloud answers with an HTML challenge page when the browser cookie is missing or expired.
      if (!res.headers.get("content-type")?.includes("json"))
        throw Object.assign(new Error("rond.ir returned a challenge page: set ROND_COOKIE from your browser (see README)"), { fatal: true });
      return (await res.json()) as RondPage;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      lastErr = e;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}
