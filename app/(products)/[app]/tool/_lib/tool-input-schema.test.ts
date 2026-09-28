import { describe, expect, it } from "vitest";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { toolInputSchema } from "./tool-input-schema";

type Field = ProductConfig["inputs"][number];

const lettreProFields: Field[] = [
  { key: "poste", label: "Poste visé", type: "text", required: true },
  { key: "entreprise", label: "Entreprise", type: "text", required: true },
  { key: "experience", label: "Votre expérience", type: "textarea", required: true },
  { key: "ton", label: "Ton", type: "select", required: true, options: ["formel", "dynamique"] },
];

const validInput = {
  poste: "Développeur Frontend",
  entreprise: "Dotworld",
  experience: "3 ans en React",
  ton: "dynamique",
};

describe("toolInputSchema", () => {
  it("parses a valid input for every field", () => {
    const result = toolInputSchema(lettreProFields, validInput);
    expect(result).toEqual({ success: true, data: validInput });
  });

  it("rejects a missing required field with the 'required' issue", () => {
    const { entreprise, experience, ton } = validInput;
    const result = toolInputSchema(lettreProFields, { entreprise, experience, ton });
    expect(result).toEqual({ success: false, fieldErrors: { poste: "required" } });
  });

  it("rejects a blank (whitespace-only) required field with 'required'", () => {
    const result = toolInputSchema(lettreProFields, { ...validInput, poste: "   " });
    expect(result).toEqual({ success: false, fieldErrors: { poste: "required" } });
  });

  it("rejects a select value outside its options with 'invalid_option'", () => {
    const result = toolInputSchema(lettreProFields, { ...validInput, ton: "sarcastique" });
    expect(result).toEqual({ success: false, fieldErrors: { ton: "invalid_option" } });
  });

  it("rejects a value longer than the field's maxLength with 'too_long'", () => {
    const fields: Field[] = [{ key: "poste", label: "Poste visé", type: "text", required: true, maxLength: 5 }];
    const result = toolInputSchema(fields, { poste: "Développeur" });
    expect(result).toEqual({ success: false, fieldErrors: { poste: "too_long" } });
  });

  it("rejects a key that is not one of the product's fields with 'unknown_field'", () => {
    const result = toolInputSchema(lettreProFields, { ...validInput, extra: "hack" });
    expect(result).toEqual({ success: false, fieldErrors: { extra: "unknown_field" } });
  });

  it("accepts an empty string for an optional field", () => {
    const fields: Field[] = [{ key: "note", label: "Note", type: "text", required: false }];
    const result = toolInputSchema(fields, { note: "" });
    expect(result).toEqual({ success: true, data: { note: "" } });
  });

  it("reports every failing field at once", () => {
    const result = toolInputSchema(lettreProFields, { poste: "", entreprise: "Dotworld", experience: "", ton: "x" });
    expect(result).toEqual({
      success: false,
      fieldErrors: { poste: "required", experience: "required", ton: "invalid_option" },
    });
  });

  // AI-GUARD: a product without an explicit `maxLength` (BO-05 has no field
  // for it) left a `text`/`textarea` field bound only by the 5 000-char
  // global limit, wide open to a prompt-injection payload. The platform
  // default (docs/05-ia.md) closes that gap even when the config forgets it.
  describe("default maxLength when the field sets none (docs/05-ia.md)", () => {
    it("accepts exactly 150 characters on a text field", () => {
      const fields: Field[] = [{ key: "poste", label: "Poste visé", type: "text", required: true }];
      const result = toolInputSchema(fields, { poste: "a".repeat(150) });
      expect(result.success).toBe(true);
    });

    it("rejects 151 characters on a text field with 'too_long'", () => {
      const fields: Field[] = [{ key: "poste", label: "Poste visé", type: "text", required: true }];
      const result = toolInputSchema(fields, { poste: "a".repeat(151) });
      expect(result).toEqual({ success: false, fieldErrors: { poste: "too_long" } });
    });

    it("accepts exactly 1 500 characters on a textarea field", () => {
      const fields: Field[] = [{ key: "experience", label: "Expérience", type: "textarea", required: true }];
      const result = toolInputSchema(fields, { experience: "a".repeat(1500) });
      expect(result.success).toBe(true);
    });

    it("rejects 1 501 characters on a textarea field with 'too_long'", () => {
      const fields: Field[] = [{ key: "experience", label: "Expérience", type: "textarea", required: true }];
      const result = toolInputSchema(fields, { experience: "a".repeat(1501) });
      expect(result).toEqual({ success: false, fieldErrors: { experience: "too_long" } });
    });
  });

  // A `Math.min(explicit, default)` implementation would silently shrink a
  // deliberately larger explicit maxLength back down to the default: this
  // proves `??` wins, not the smaller of the two.
  describe("an explicit maxLength always replaces the default (docs/05-ia.md)", () => {
    it("a larger explicit maxLength on a text field accepts a value beyond the 150 default", () => {
      const fields: Field[] = [{ key: "poste", label: "Poste visé", type: "text", required: true, maxLength: 300 }];
      const result = toolInputSchema(fields, { poste: "a".repeat(200) });
      expect(result.success).toBe(true);
    });

    it("a larger explicit maxLength on a textarea field accepts a value beyond the 1 500 default", () => {
      const fields: Field[] = [
        { key: "experience", label: "Expérience", type: "textarea", required: true, maxLength: 3000 },
      ];
      const result = toolInputSchema(fields, { experience: "a".repeat(2000) });
      expect(result.success).toBe(true);
    });
  });

  // A default keyed only by `field.type` (rather than excluding `select`)
  // would wrongly cap a select's own option values.
  it("a select field has no default length: a 200-character option value is accepted", () => {
    const longOption = "a".repeat(200);
    const fields: Field[] = [{ key: "style", label: "Style", type: "select", required: true, options: [longOption] }];
    const result = toolInputSchema(fields, { style: longOption });
    expect(result).toEqual({ success: true, data: { style: longOption } });
  });
});
