import { describe, expect, it } from "vitest";
import { parseMobile } from "../lib/numbers/normalize";
import { detectPatterns } from "../lib/numbers/patterns";
import { estimatePrice } from "../lib/numbers/estimate";

const keys = (body: string) => detectPatterns(body, "0912").map((p) => p.key);

describe("parseMobile", () => {
  it("normalizes Persian digits and country codes", () => {
    expect(parseMobile("۰۹۱۲۱۰۰۳۰۸۸")?.full).toBe("09121003088");
    expect(parseMobile("+98 912 100 3088")?.full).toBe("09121003088");
    expect(parseMobile("9121003088")?.body).toBe("1003088");
  });
  it("rejects invalid input", () => {
    expect(parseMobile("0212345678")).toBeNull();
    expect(parseMobile("0912")).toBeNull();
  });
});

describe("detectPatterns", () => {
  it("finds repeated, sequential and zero patterns", () => {
    expect(keys("1114471")).toContain("three_same_start");
    expect(keys("4567890")).toContain("seq_start");
    expect(keys("1000799")).toContain("thousand_start");
    expect(keys("1234321")).toContain("mirror");
    expect(keys("1111111")).toContain("seven_same");
  });
  it("falls back to ordinary", () => {
    expect(keys("4398257")).toEqual(["ordinary"]);
  });
});

describe("estimatePrice", () => {
  const listings = [
    { number: "09121111222", price: 1_000_000_000 },
    { number: "09123333444", price: 900_000_000 },
    { number: "09124398257", price: 100_000_000 },
    { number: "09122852779", price: null },
  ];
  it("returns the exact price for a listed number", () => {
    expect(estimatePrice("09124398257", listings)?.price?.mid).toBe(100_000_000);
  });
  it("prefers patterned neighbours and ignores unpriced listings", () => {
    const e = estimatePrice("09125555666", listings)!;
    expect(e.neighbors.some((n) => n.number === "09122852779")).toBe(false);
    expect(e.price!.mid).toBeGreaterThan(500_000_000);
  });
  it("returns null for invalid input", () => {
    expect(estimatePrice("123", listings)).toBeNull();
  });
});
