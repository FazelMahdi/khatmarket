/**
 * Settings an admin can change from /panel/admin without editing .env.
 * The database value wins; the environment variable of the same name is the fallback.
 */
import { prisma } from "./db";

export const SETTING_KEYS = ["AVALAI_API_KEY", "AVALAI_MODELS", "ROND_COOKIE"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
/** Never sent back to the browser in full */
export const SECRET_KEYS: SettingKey[] = ["AVALAI_API_KEY", "ROND_COOKIE"];

const TTL = 30_000;
let cache: { at: number; values: Map<string, string> } | null = null;

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  if (!cache || Date.now() - cache.at > TTL) {
    const rows = await prisma.setting.findMany().catch(() => []);
    cache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) };
  }
  return cache.values.get(key) || process.env[key] || undefined;
}

export async function setSetting(key: SettingKey, value: string) {
  const v = value.trim();
  if (v) await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  else await prisma.setting.deleteMany({ where: { key } });
  cache = null;
}

/** "set (…last 4)" style summary for the admin form */
export async function describeSettings() {
  const out: Record<string, { set: boolean; preview: string; fromEnv: boolean }> = {};
  const rows = new Map((await prisma.setting.findMany()).map((r) => [r.key, r.value]));
  for (const key of SETTING_KEYS) {
    const db = rows.get(key);
    const value = db || process.env[key] || "";
    const secret = SECRET_KEYS.includes(key);
    out[key] = {
      set: !!value,
      fromEnv: !db && !!process.env[key],
      preview: !value ? "" : secret ? `…${value.slice(-4)}` : value,
    };
  }
  return out;
}
