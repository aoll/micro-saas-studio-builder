import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { productConfigSchema } from "@/lib/schemas/product-config";
import { DEFAULT_GENERATION, DEFAULT_PRICING, moveItem, newProductDraft, toConfig } from "./form-values";

const themeId = randomUUID();

describe("newProductDraft", () => {
  it("starts with status test, locale fr, one text field and the documented defaults", () => {
    const draft = newProductDraft(themeId);
    expect(draft.status).toBe("test");
    expect(draft.locale).toBe("fr");
    expect(draft.inputs).toHaveLength(1);
    expect(draft.inputs[0]?.type).toBe("text");
    expect(draft.generation).toEqual(DEFAULT_GENERATION);
    expect(draft.pricing).toEqual(DEFAULT_PRICING);
  });

  it("once filled in, converts to a config the shared schema accepts", () => {
    const draft = newProductDraft(themeId);
    draft.slug = "generateur-de-bio-instagram";
    draft.name = "Générateur de bio Instagram";
    draft.landing = {
      headline: "Une bio qui donne envie",
      subheadline: "En 10 secondes",
      faq: [],
      seoTitle: "Générateur de bio Instagram",
      seoDescription: "Créez une bio Instagram qui convertit en quelques secondes.",
    };

    const config = toConfig(draft);
    expect(productConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("toConfig", () => {
  it("drops an empty branding object down to {}", () => {
    const draft = newProductDraft(themeId);
    draft.branding = { logoUrl: "", primaryColor: "" };
    const config = toConfig(draft);
    expect(config.branding).toEqual({});
  });

  it("keeps a filled branding value", () => {
    const draft = newProductDraft(themeId);
    draft.branding = { primaryColor: "#d946ef" };
    const config = toConfig(draft);
    expect(config.branding).toEqual({ primaryColor: "#d946ef" });
  });

  it("drops options on a non-select field", () => {
    const draft = newProductDraft(themeId);
    draft.inputs = [{ ...draft.inputs[0]!, type: "text", options: ["a", "b"] }];
    const config = toConfig(draft);
    expect(config.inputs[0]?.options).toBeUndefined();
  });

  it("drops empty option lines on a select field", () => {
    const draft = newProductDraft(themeId);
    draft.inputs = [{ ...draft.inputs[0]!, type: "select", options: ["formel", "", "  ", "dynamique"] }];
    const config = toConfig(draft);
    expect(config.inputs[0]?.options).toEqual(["formel", "dynamique"]);
  });

  it("trims text values", () => {
    const draft = newProductDraft(themeId);
    draft.name = "  Générateur  ";
    draft.landing.headline = "  Une bio  ";
    const config = toConfig(draft);
    expect(config.name).toBe("Générateur");
    expect(config.landing.headline).toBe("Une bio");
  });

  it("strips the client-only id from every field, and does not mutate its input", () => {
    const draft = newProductDraft(themeId);
    const before = JSON.parse(JSON.stringify(draft));
    const config = toConfig(draft);
    expect((config.inputs[0] as Record<string, unknown>).id).toBeUndefined();
    expect(draft).toEqual(before);
  });
});

describe("moveItem", () => {
  it("swaps two adjacent items", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, "down")).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 1, "up")).toEqual(["b", "a", "c"]);
  });

  it("is a no-op at the top edge", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, "up")).toEqual(items);
  });

  it("is a no-op at the bottom edge", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, "down")).toEqual(items);
  });

  it("returns a new array instead of mutating the input", () => {
    const items = ["a", "b", "c"];
    const moved = moveItem(items, 0, "down");
    expect(moved).not.toBe(items);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
