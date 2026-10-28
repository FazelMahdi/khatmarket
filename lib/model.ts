import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { PriceModel } from "./numbers/estimate";

const FILE = path.join(process.cwd(), "data", "model.json");
let cached: { mtime: number; model: PriceModel } | null = null;

/** Learned price factors from `npm run rond:learn`; empty (neutral) when missing. */
export function loadModel(): PriceModel {
  if (!existsSync(FILE)) return {};
  const mtime = statSync(FILE).mtimeMs;
  if (cached?.mtime !== mtime) cached = { mtime, model: JSON.parse(readFileSync(FILE, "utf8")) };
  return cached.model;
}
