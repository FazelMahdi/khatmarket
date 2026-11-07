import { describe, expect, it } from "vitest";
import { levelRatio, levelsFrom, snapshotLevels } from "../lib/rond/levels";

describe("code-block levels", () => {
  it("knows 0912's code blocks: code 1 well above code 7, 100 far above 13x", () => {
    const lv = snapshotLevels("0912")!;
    expect(lv("1003088")).toBe(5_000_000_000); // 0912 100
    expect(levelRatio(lv, "1003088", "7003088")).toBeGreaterThan(10);
    expect(levelRatio(lv, "1353088", "1003088")).toBeLessThan(0.25);
    expect(levelRatio(snapshotLevels("0935"), "1234567", "7234567")).toBe(1); // unknown pre-code
  });

  it("takes the median of the plainest numbers per block, falling back to shorter blocks", () => {
    // plain: after the block only the 00 pair (structure value 4)
    const tails = ["235", "236", "238", "239", "256", "258", "259", "267", "268", "269", "278", "279", "289", "356", "358"];
    const rows = [
      ...tails.map((t) => ({ number: `09121004${t}`, price: 5e9 })),
      ...tails.map((t) => ({ number: `09127004${t}`, price: 4e8 })),
      { number: "09121007777", price: 9e10 }, // rest is a pattern: not plain, ignored
    ];
    const lv = levelsFrom(rows);
    expect(lv("1003088")).toBe(5e9);
    expect(lv("7003088")).toBe(4e8);
    expect(lv("5003088")).toBeUndefined();
  });
});
