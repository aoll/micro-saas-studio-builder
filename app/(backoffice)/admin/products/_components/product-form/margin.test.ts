import { describe, expect, it } from "vitest";
import type { Pack } from "@/lib/schemas/pack";
import { estimateMargins, formatEur, formatUsd, revenuePerGenerationMicros } from "./margin";

const pack10: Pack = { id: "pack-10", credits: 10, priceCents: 490 };
const pack50: Pack = { id: "pack-50", credits: 50, priceCents: 1490, recommended: true };

describe("revenuePerGenerationMicros", () => {
  it("a 10-credit pack at 4.90€ costing 1 credit per generation: 49 000 micros", () => {
    // 490 cents / 10 credits = 49 cents/credit = 490 000 micros/credit;
    // 1 credit per generation → 490 000 micros. (priceCents × 10 000 is
    // cents→micros: 1 cent = 10 000 micro-dollars, docs/07's cost_micros.)
    expect(revenuePerGenerationMicros(pack10, 1)).toBe(490_000);
  });

  it("scales with the number of credits a generation costs", () => {
    expect(revenuePerGenerationMicros(pack10, 2)).toBe(980_000);
  });

  it("a 50-credit pack at 14.90€: 298 000 micros per credit", () => {
    expect(revenuePerGenerationMicros(pack50, 1)).toBe(298_000);
  });
});

describe("estimateMargins", () => {
  it("returns one entry per pack, with a positive margin when revenue exceeds the AI cost", () => {
    const margins = estimateMargins([pack10], 1, 4_000);
    expect(margins).toEqual([{ packId: "pack-10", revenuePerGenerationMicros: 490_000, marginMicros: 486_000 }]);
  });

  it("can be negative when the AI cost exceeds the pack's revenue per generation", () => {
    const margins = estimateMargins([pack10], 1, 600_000);
    expect(margins[0]).toMatchObject({ marginMicros: -110_000 });
  });

  it("one entry per pack, in the given order", () => {
    const margins = estimateMargins([pack10, pack50], 1, 4_000);
    expect(margins.map((margin) => margin.packId)).toEqual(["pack-10", "pack-50"]);
  });
});

describe("formatEur", () => {
  it("formats cents as euros with 2 decimals", () => {
    expect(formatEur(490)).toBe("4,90 €");
  });

  it("formats 0 cents", () => {
    expect(formatEur(0)).toBe("0,00 €");
  });
});

describe("formatUsd", () => {
  it("formats micro-dollars as a small dollar amount", () => {
    expect(formatUsd(910)).toBe("$0.000910");
  });

  it("formats 0 micros", () => {
    expect(formatUsd(0)).toBe("$0.000000");
  });

  it("formats a negative amount with its sign", () => {
    expect(formatUsd(-110_000)).toBe("-$0.110000");
  });
});
