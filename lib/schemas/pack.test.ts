import { describe, expect, expectTypeOf, it } from "vitest";
import { packSchema, type Pack } from "./pack";

describe("packSchema", () => {
  it("parses a valid pack", () => {
    const result = packSchema.safeParse({ id: "pack-10", credits: 10, priceCents: 490 });
    expect(result.success).toBe(true);
  });

  it("accepts an optional recommended flag", () => {
    const result = packSchema.safeParse({ id: "pack-50", credits: 50, priceCents: 1490, recommended: true });
    expect(result.success).toBe(true);
  });

  it("rejects a credits value of zero", () => {
    const result = packSchema.safeParse({ id: "pack-10", credits: 0, priceCents: 490 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer credits value", () => {
    const result = packSchema.safeParse({ id: "pack-10", credits: 1.5, priceCents: 490 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative priceCents", () => {
    const result = packSchema.safeParse({ id: "pack-10", credits: 10, priceCents: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects an id that is not a kebab-case slug", () => {
    const result = packSchema.safeParse({ id: "Pack 10", credits: 10, priceCents: 490 });
    expect(result.success).toBe(false);
  });

  it("infers credits as a number", () => {
    const pack: Pack = { id: "pack-10", credits: 10, priceCents: 490 };
    expect(pack.credits).toBe(10);
  });

  it("pins the Pack type", () => {
    expectTypeOf<Pack>().toEqualTypeOf<{
      id: string;
      credits: number;
      priceCents: number;
      recommended?: boolean;
    }>();
  });
});
