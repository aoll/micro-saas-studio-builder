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
});
