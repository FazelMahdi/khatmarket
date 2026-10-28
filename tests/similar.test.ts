import { describe, expect, it } from "vitest";
import { blankMasks, findSimilar, maskRounds, shifts, structureLoss, type RondApi } from "../lib/rond/similar";

const LOW = { id: "low", algorithm: "کد پایین", priority: 170 };
const K = { id: "k", algorithm: "هزاری از اول", priority: 190 };
const BIRTH = { id: "b", algorithm: "تاریخ تولدی", priority: 35 };

// Real rond.ir prices (toman) and types around 09121003088, Oct 2026.
const LISTED = [
  { simCardNumber: "09121003086", price: 4_850_000_000, types: [LOW, K] },
  { simCardNumber: "09121903088", price: 1_110_000_000, types: [BIRTH] },
  { simCardNumber: "09121003188", price: 4_700_000_000, types: [LOW, K] },
  { simCardNumber: "09121003069", price: 5_200_000_000, types: [LOW, K] },
  { simCardNumber: "09121000010", price: null, types: [LOW, K] },
  { simCardNumber: "09122114199", price: 300_000_000, types: [] }, // shifted copy, no کد پایین
  { simCardNumber: "09122002022", price: 18_000_000_000, types: [LOW, K] }, // same 00_0, plus four 2s
];

/** Fake rond.ir: digit boxes + AND type filter, and rond-bot. */
const api: RondApi = {
  search: async (pre, pattern, ids) =>
    LISTED.filter((l) => new RegExp(`^${pre}${pattern}$`).test(l.simCardNumber) && ids.every((id) => l.types.some((t) => t.id === id))),
  types: async (full) => LISTED.find((l) => l.simCardNumber === full)?.types ?? (full === "09121003088" ? [LOW, K] : []),
};

describe("findSimilar", () => {
  it("builds rounds: one-box changes, then blanks from the right", () => {
    expect(blankMasks("1003088", 1)).toHaveLength(7);
    expect(shifts("1234567")).toContain("2345678");
    expect(maskRounds("1003088").map((r) => r[0])).toEqual([
      "1003088", "10030__", "1003___", "100____", "10_____", "1______", "_______",
    ]);
  });

  it("measures lost rond structure, super-linear in run length", () => {
    expect(structureLoss("1234567", "2345678")).toBe(0);
    expect(structureLoss("1234567", "1230789")).toBeCloseTo(40 / 49); // 7-run -> 3-run
    expect(structureLoss("1003088", "1003086")).toBeCloseTo(3 / 13); // the 88 pair of 0s(9)+88(4)
  });

  it("ranks by kept rond structure and rond.ir type, then same boxes, and prices from the nearest", async () => {
    const r = await findSimilar("09121003088", api);
    expect(r.types.map((t) => t.algorithm)).toEqual(["کد پایین", "هزاری از اول"]);
    // 09121903088 shares 6 boxes but breaks the 00_0 and is another type (تاریخ تولدی), so it ranks last.
    expect(r.matches.map((m) => m.number)).toEqual(["09121003086", "09121003069", "09121003188", "09122002022", "09122114199", "09121903088"]);
    expect(r.price?.mid).toBe(4_800_000_000); // median 4.85B, 2 significant digits
  });

  it("uses the listing's own price when the number itself is on rond.ir", async () => {
    const r = await findSimilar("09121003086", api);
    expect(r.price).toEqual({ low: 4_850_000_000, mid: 4_850_000_000, high: 4_850_000_000 });
    expect(r.confidence).toBe("high");
  });
});
