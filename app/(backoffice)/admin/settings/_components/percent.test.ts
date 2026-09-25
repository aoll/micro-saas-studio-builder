import { describe, expect, it } from "vitest";
import { parsePercentInput, percentToRate, rateToPercent } from "./percent";

describe("percentToRate", () => {
  it("converts a whole percent to a rate", () => {
    expect(percentToRate(2)).toBe(0.02);
    expect(percentToRate(5)).toBe(0.05);
  });

  it("rounds to 4 decimals", () => {
    expect(percentToRate(2.34567)).toBe(0.0235);
  });

  it("propagates NaN", () => {
    expect(percentToRate(NaN)).toBeNaN();
  });
});

describe("rateToPercent", () => {
  it("converts a rate back to a percent", () => {
    expect(rateToPercent(0.02)).toBe(2);
    expect(rateToPercent(0.05)).toBe(5);
  });

  it("round-trips with percentToRate", () => {
    expect(rateToPercent(percentToRate(3.5))).toBeCloseTo(3.5, 4);
  });
});

describe("parsePercentInput", () => {
  it("parses a numeric string", () => {
    expect(parsePercentInput("2")).toBe(2);
    expect(parsePercentInput("2.5")).toBe(2.5);
  });

  it("returns NaN for an empty string", () => {
    expect(parsePercentInput("")).toBeNaN();
  });

  it("returns NaN for a non-numeric string", () => {
    expect(parsePercentInput("abc")).toBeNaN();
  });
});
