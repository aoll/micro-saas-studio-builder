import { describe, expect, it } from "vitest";
import { formatEuroCents, formatEuroMicros, formatNumber, formatPercent } from "./format";

// I18N-BACKOFFICE-STRINGS (spec "Décisions de portée" › formatage des
// nombres): the locale now comes from the caller (no more hard-coded
// "fr-FR"). `Intl`'s fr locale data uses a no-break space (U+00A0) before €
// and %, and a narrow no-break space (U+202F) between thousands groups —
// not a plain space.
const NBSP = " ";
const NNBSP = " ";

describe("formatEuroCents", () => {
  it("formats cents as euros in fr", () => {
    expect(formatEuroCents(2470, "fr")).toBe(`24,70${NBSP}€`);
  });

  it("formats cents as euros in en", () => {
    expect(formatEuroCents(2470, "en")).toBe("€24.70");
  });

  it("formats 0 cents", () => {
    expect(formatEuroCents(0, "fr")).toBe(`0,00${NBSP}€`);
  });
});

describe("formatEuroMicros", () => {
  it("formats micros as euros, at 1 USD = 1 EUR (plan design decision 6)", () => {
    expect(formatEuroMicros(4_000_000, "fr")).toBe(`4,00${NBSP}€`);
  });

  it("formats a negative margin", () => {
    expect(formatEuroMicros(-5_000_000, "fr")).toBe(`-5,00${NBSP}€`);
  });

  it("adds decimals so a non-zero sub-cent cost never reads 0,00 €", () => {
    expect(formatEuroMicros(1_180, "fr")).toBe(`0,0012${NBSP}€`);
    expect(formatEuroMicros(295, "fr")).toBe(`0,0003${NBSP}€`);
    expect(formatEuroMicros(4_000, "fr")).toBe(`0,004${NBSP}€`);
    expect(formatEuroMicros(1, "fr")).toBe(`0,000001${NBSP}€`);
    expect(formatEuroMicros(490_000, "fr")).toBe(`0,49${NBSP}€`);
    expect(formatEuroMicros(0, "fr")).toBe(`0,00${NBSP}€`);
  });

  it("honours a larger minimum of decimals", () => {
    expect(formatEuroMicros(0, "fr", 3)).toBe(`0,000${NBSP}€`);
    expect(formatEuroMicros(4_000_000, "fr", 3)).toBe(`4,000${NBSP}€`);
  });

  it("formats in en", () => {
    expect(formatEuroMicros(4_000_000, "en")).toBe("€4.00");
  });
});

describe("formatPercent", () => {
  it("formats a rate as a percentage in fr", () => {
    expect(formatPercent(0.5, "fr")).toBe(`50${NBSP}%`);
  });

  it("formats a rate as a percentage in en", () => {
    expect(formatPercent(0.5, "en")).toBe("50%");
  });

  it("returns an em dash for a null rate regardless of locale", () => {
    expect(formatPercent(null, "fr")).toBe("—");
    expect(formatPercent(null, "en")).toBe("—");
  });

  it("rounds to at most one decimal", () => {
    expect(formatPercent(0.019, "fr")).toBe(`1,9${NBSP}%`);
  });
});

describe("formatNumber", () => {
  it("groups thousands in fr", () => {
    expect(formatNumber(4200, "fr")).toBe(`4${NNBSP}200`);
  });

  it("groups thousands in en", () => {
    expect(formatNumber(4200, "en")).toBe("4,200");
  });
});
