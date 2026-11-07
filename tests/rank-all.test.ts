import { describe, expect, it } from "vitest";
import { rankAll } from "../lib/rond/rank-all";

const row = (number: string, price: number, types: string[] = []) => ({ number, price, status: null, types });

describe("rankAll", () => {
  it("compares every listing and puts the closest structure first", () => {
    const rows = [
      row("09124398257", 150e6),
      row("09122002022", 18e9, ["متشکل از دو رقم"]),
      row("09121003188", 900e6, ["کد پایین"]),
      row("09127003088", 400e6, ["کد پایین"]),
    ];
    const r = rankAll("09121003088", rows, [{ id: "x", algorithm: "کد پایین", priority: 170 }]);
    expect(r.scanned).toBe(4);
    expect(r.matches).toHaveLength(4);
    // Code 1 before the same shape in code 7 (0912 700 is ~1/12 of 0912 100), and the code-7
    // price is scaled up to code 1 rather than taken as is. The 18B number is not a peer.
    expect(r.matches.map((m) => m.number).slice(0, 2)).toEqual(["09121003188", "09127003088"]);
    expect(r.matches[1].ratio).toBeCloseTo(5000 / 400);
  });

  it("handles a full pre-code quickly", () => {
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rows = Array.from({ length: 50_000 }, () => row("0912" + String(Math.floor(rnd() * 1e7)).padStart(7, "0"), 1e8 + rnd() * 1e9));
    const t = performance.now();
    const r = rankAll("09121003088", rows, []);
    expect(r.scanned).toBe(50_000);
    expect(r.price).not.toBeNull();
    expect(performance.now() - t).toBeLessThan(3000);
  });
});
