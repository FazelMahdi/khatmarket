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
    // Same structure (lost 0) and same rond.ir type first; the much rounder 18B number is not a peer.
    expect(r.matches.map((m) => m.number).slice(0, 2)).toEqual(["09127003088", "09121003188"]);
    expect(r.matches[0].lost).toBe(0);
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
