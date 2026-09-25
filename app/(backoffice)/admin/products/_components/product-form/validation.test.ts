import { describe, expect, it } from "vitest";
import { stepOfPath, validateStep } from "./validation";

describe("stepOfPath", () => {
  it("maps a slug path to step 1", () => {
    expect(stepOfPath(["slug"])).toBe(1);
  });

  it("maps a branding path to step 2", () => {
    expect(stepOfPath(["branding", "primaryColor"])).toBe(2);
  });

  it("maps a landing path to step 3", () => {
    expect(stepOfPath(["landing", "faq", 0, "answer"])).toBe(3);
  });

  it("maps an inputs path to step 4", () => {
    expect(stepOfPath(["inputs", 1, "key"])).toBe(4);
  });
});

describe("validateStep", () => {
  it("step 1: a reserved slug reports only slug", () => {
    const errors = validateStep(1, { slug: "admin" });
    expect(errors).toEqual({ slug: "Ce slug est réservé" });
  });

  it("step 4: duplicate keys report the second occurrence, even though other steps are still blank", () => {
    const errors = validateStep(4, {
      inputs: [
        { key: "sujet", label: "Sujet", type: "text", required: true },
        { key: "sujet", label: "Autre", type: "text", required: false },
      ],
    });
    expect(errors).toEqual({ "inputs.1.key": "Clé déjà utilisée" });
  });

  it("step 3: a 61-character SEO title reports the 60-character limit", () => {
    const errors = validateStep(3, {
      landing: {
        headline: "H",
        subheadline: "S",
        faq: [],
        seoTitle: "x".repeat(61),
        seoDescription: "D",
      },
    });
    expect(errors["landing.seoTitle"]).toBe("60 caractères maximum");
  });

  it("keeps only the first message per path", () => {
    const errors = validateStep(1, { slug: "Admin " });
    expect(Object.keys(errors).filter((path) => path === "slug")).toHaveLength(1);
  });

  it("returns no error for a fully valid step", () => {
    const errors = validateStep(1, { slug: "lettre-pro-2" });
    expect(errors).toEqual({});
  });
});
