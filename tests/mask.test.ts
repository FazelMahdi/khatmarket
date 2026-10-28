import { describe, expect, it } from "vitest";
import { buildMasks, formatMask, matchesMask } from "../lib/numbers/mask";
import { estimatePrice } from "../lib/numbers/estimate";

describe("buildMasks", () => {
  it("builds the friend's search for 09121003088 (0912-00-0)", () => {
    const masks = buildMasks("1003088").map((m) => m.mask);
    expect(masks).toContain("_00_0__");
    expect(formatMask("0912", "_00_0__")).toBe("0912-00-0");
  });
  it("orders masks from most to least specific", () => {
    const fixed = buildMasks("1114471").map((m) => m.fixed);
    expect(fixed).toEqual([...fixed].sort((a, b) => b - a));
  });
  it("keeps sequences and runs", () => {
    const masks = buildMasks("4567890").map((m) => m.mask);
    expect(masks.some((m) => m.startsWith("4567"))).toBe(true);
  });
});

describe("matchesMask", () => {
  it("treats _ as any digit", () => {
    expect(matchesMask("5003077", "_00_0__")).toBe(true);
    expect(matchesMask("5013077", "_00_0__")).toBe(false);
  });
});

describe("mask estimate", () => {
  const listings = [
    { number: "09125003011", price: 400_000_000 },
    { number: "09127004052", price: 500_000_000 },
    { number: "09129002063", price: 600_000_000 },
    { number: "09121111111", price: 90_000_000_000 },
    { number: "09124398257", price: 100_000_000 },
  ];
  it("prices from listings matching the rond digits", () => {
    const e = estimatePrice("09121003088", listings)!;
    expect(e.method).toBe("mask");
    expect(e.search?.display).toBe("0912-00-0");
    expect(e.price!.mid).toBeGreaterThanOrEqual(400_000_000);
    expect(e.price!.mid).toBeLessThanOrEqual(600_000_000);
  });
  it("applies learned pre-code factors to other pre-codes", () => {
    const other = listings.map((l) => ({ ...l, number: "0919" + l.number.slice(4) }));
    const e = estimatePrice("09121003088", other, { precodeFactor: { "0912": 1, "0919": 0.5 }, minMatches: 2 })!;
    expect(e.price!.mid).toBeGreaterThanOrEqual(800_000_000);
  });
});
