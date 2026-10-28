import { readFileSync } from "node:fs";
import { estimatePrice } from "../lib/numbers/estimate";
import { detectPatterns, features } from "../lib/numbers/patterns";

const listings = JSON.parse(readFileSync("data/sample-mci-0912.json", "utf8"));
if (process.argv[2] === "tags") {
  for (const l of listings) {
    console.log(l.number, String(l.price ?? "-").padStart(12), detectPatterns(l.number.slice(4), "0912").map((p) => p.label).join(" | "));
  }
} else {
  const e = estimatePrice(process.argv[2] ?? "09121003088", listings);
  console.log(JSON.stringify(e, null, 1));
  if (e) console.log(features(e.number.slice(4)));
}
