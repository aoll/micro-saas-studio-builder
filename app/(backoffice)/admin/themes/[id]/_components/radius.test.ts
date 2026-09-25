import { describe, expect, it } from "vitest";
import { themeTokensSchema } from "@/lib/schemas/theme-tokens";
import { radiusToRem, remToRadius } from "./radius";

const RADIUS_SCHEMA = themeTokensSchema.shape.radius;

describe("radiusToRem", () => {
  it("parses a rem length", () => {
    expect(radiusToRem("0.5rem")).toBe(0.5);
  });

  it("parses a px length by converting to rem (16px base)", () => {
    expect(radiusToRem("8px")).toBe(0.5);
  });

  it("parses an integer rem length without a decimal point", () => {
    expect(radiusToRem("2rem")).toBe(2);
  });
});

describe("remToRadius", () => {
  it("formats a rem number back to a CSS length", () => {
    expect(remToRadius(0.5)).toBe("0.5rem");
  });

  it("round-trips through radiusToRem", () => {
    expect(radiusToRem(remToRadius(1.125))).toBe(1.125);
  });

  it("clamps below the slider's minimum (0)", () => {
    expect(remToRadius(-1)).toBe("0rem");
  });

  it("clamps above the slider's maximum (2rem)", () => {
    expect(remToRadius(3)).toBe("2rem");
  });

  it.each([0, 0.125, 0.5, 1, 1.375, 2])("produces a value the frozen schema accepts (%s)", (value) => {
    expect(RADIUS_SCHEMA.safeParse(remToRadius(value)).success).toBe(true);
  });
});
