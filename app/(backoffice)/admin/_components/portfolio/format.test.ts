import { describe, expect, it } from "vitest";
import { formatEuroCents, formatEuroMicros, formatNumber, formatPercent } from "./format";

// French formatting for the portfolio table and KPIs (docs/08-stack.md: the
// backoffice stays in French, no next-intl there). `Intl`'s fr-FR locale
// data uses a no-break space (U+00A0) before € and %, and a narrow no-break
// space (U+202F) between thousands groups — not a plain space.
const NBSP = " ";
const NNBSP = " ";

describe("formatEuroCents", () => {
  it("formats cents as euros", () => {
    expect(formatEuroCents(2470)).toBe(`24,70${NBSP}€`);
  });

  it("formats 0 cents", () => {
    expect(formatEuroCents(0)).toBe(`0,00${NBSP}€`);
  });
});

describe("formatEuroMicros", () => {
  it("formats micros as euros, at 1 USD = 1 EUR (plan design decision 6)", () => {
    expect(formatEuroMicros(4_000_000)).toBe(`4,00${NBSP}€`);
  });

  it("formats a negative margin", () => {
    expect(formatEuroMicros(-5_000_000)).toBe(`-5,00${NBSP}€`);
  });

  it("adds decimals so a non-zero sub-cent cost never reads 0,00 €", () => {
    expect(formatEuroMicros(1_180)).toBe(`0,0012${NBSP}€`);
    expect(formatEuroMicros(295)).toBe(`0,0003${NBSP}€`);
    expect(formatEuroMicros(4_000)).toBe(`0,004${NBSP}€`);
    expect(formatEuroMicros(1)).toBe(`0,000001${NBSP}€`);
    expect(formatEuroMicros(490_000)).toBe(`0,49${NBSP}€`);
    expect(formatEuroMicros(0)).toBe(`0,00${NBSP}€`);
  });

  it("honours a larger minimum of decimals", () => {
    expect(formatEuroMicros(0, 3)).toBe(`0,000${NBSP}€`);
    expect(formatEuroMicros(4_000_000, 3)).toBe(`4,000${NBSP}€`);
  });
});

describe("formatPercent", () => {
  it("formats a rate as a percentage", () => {
    expect(formatPercent(0.5)).toBe(`50${NBSP}%`);
  });

  it("returns an em dash for a null rate", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("rounds to at most one decimal", () => {
    expect(formatPercent(0.019)).toBe(`1,9${NBSP}%`);
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(4200)).toBe(`4${NNBSP}200`);
  });
});
