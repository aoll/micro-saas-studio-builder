import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import { productConfigSchema } from "@/lib/schemas/product-config";
import { fromConfig, newProductDraft, toConfig } from "./form-values";
import { demoStepPatch } from "./demo-fill";

const themes = [
  { id: randomUUID(), slug: "editorial" },
  { id: randomUUID(), slug: "neon" },
] as Theme[];

describe("demoStepPatch", () => {
  it("fills steps 1 to 6 so the resulting draft is a valid product config", () => {
    let draft = newProductDraft(themes[0]!.id);
    for (let step = 1; step <= 6; step++) draft = { ...draft, ...demoStepPatch(step, themes, draft.themeId) };
    expect(productConfigSchema.safeParse(toConfig(draft)).success).toBe(true);
  });

  it("picks the neon theme, or keeps the current one when it is missing", () => {
    expect(demoStepPatch(2, themes, themes[0]!.id).themeId).toBe(themes[1]!.id);
    expect(demoStepPatch(2, [themes[0]!], "current").themeId).toBe("current");
  });

  it("has nothing to fill on the recap step", () => {
    expect(demoStepPatch(7, themes, "current")).toEqual({});
  });

  it("gives fresh client-only ids on every call", () => {
    const first = demoStepPatch(4, themes, "t").inputs?.[0]?.id;
    expect(first).toBeTruthy();
    expect(demoStepPatch(4, themes, "t").inputs?.[0]?.id).not.toBe(first);
  });
});
