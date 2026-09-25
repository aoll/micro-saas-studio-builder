import { describe, expect, it } from "vitest";
import { excerpt, summarizeInput } from "./summarize";

const LETTRE_PRO_FIELDS = [
  { key: "poste", label: "Poste visé", type: "text" as const, required: true },
  { key: "entreprise", label: "Entreprise", type: "text" as const, required: true },
  { key: "experience", label: "Votre expérience", type: "textarea" as const, required: true },
  { key: "ton", label: "Ton", type: "select" as const, required: true },
];

describe("summarizeInput", () => {
  it("joins values in config field order, ignoring the input's own key order", () => {
    const input = { ton: "dynamique", poste: "Développeur", entreprise: "Dotworld", experience: "3 ans" };
    const summary = summarizeInput(input, LETTRE_PRO_FIELDS, 200);
    expect(summary).toBe(
      "Poste visé : Développeur · Entreprise : Dotworld · Votre expérience : 3 ans · Ton : dynamique",
    );
  });

  it("skips blank or missing values", () => {
    const input = { poste: "Développeur", entreprise: "", ton: "dynamique" };
    const summary = summarizeInput(input, LETTRE_PRO_FIELDS);
    expect(summary).toBe("Poste visé : Développeur · Ton : dynamique");
  });

  it("appends unknown keys (not declared in the product's fields) after the known ones", () => {
    const input = { poste: "Développeur", legacyField: "old value" };
    const summary = summarizeInput(input, LETTRE_PRO_FIELDS);
    expect(summary).toBe("Poste visé : Développeur · legacyField : old value");
  });

  it("truncates the whole joined summary to max characters with an ellipsis, by code point", () => {
    const input = { poste: "Développeur senior spécialisé en systèmes distribués" };
    const summary = summarizeInput(input, [LETTRE_PRO_FIELDS[0]!], 20);
    expect(summary.length <= 21).toBe(true);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("returns an empty string for an empty input", () => {
    expect(summarizeInput({}, LETTRE_PRO_FIELDS)).toBe("");
  });
});

describe("excerpt", () => {
  it("collapses newlines and repeated whitespace into single spaces", () => {
    expect(excerpt("Bonjour,\n\n  voici   votre lettre.")).toBe("Bonjour, voici votre lettre.");
  });

  it("truncates to max characters with an ellipsis", () => {
    const text = "a".repeat(200);
    const result = excerpt(text, 120);
    expect(result).toBe(`${"a".repeat(120)}…`);
  });

  it("does not truncate a text shorter than max", () => {
    expect(excerpt("short text")).toBe("short text");
  });

  it("returns an empty string for empty input", () => {
    expect(excerpt("")).toBe("");
  });
});
