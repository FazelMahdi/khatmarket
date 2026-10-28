import { readFileSync } from "node:fs";
import { estimatePrice } from "../lib/numbers/estimate";

const listings = JSON.parse(readFileSync("data/sample-mci-0912.json", "utf8"));
const e = estimatePrice(process.argv[2] ?? "09121003088", listings);
if (!e) throw new Error("invalid number");
console.log(e.number, e.method, e.search?.display, e.price, e.confidence);
console.log("alternatives:", e.alternatives.map((a) => `${a.display} (${a.count})`).join("  "));
console.log("matches:", e.neighbors.map((n) => `${n.number}:${n.price}`).join("  "));
