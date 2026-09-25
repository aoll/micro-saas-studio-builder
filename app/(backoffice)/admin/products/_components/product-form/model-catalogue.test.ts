import { describe, expect, it } from "vitest";
import { MODEL_CATALOGUE, MODEL_CATALOGUE_VALUES } from "./model-catalogue";

describe("MODEL_CATALOGUE", () => {
  it("lists Claude Haiku 4.5 and Claude Sonnet 5", () => {
    expect(MODEL_CATALOGUE).toEqual([
      { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
      { value: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
    ]);
  });

  it("MODEL_CATALOGUE_VALUES mirrors the catalogue's values", () => {
    expect(MODEL_CATALOGUE_VALUES).toEqual(MODEL_CATALOGUE.map((option) => option.value));
  });
});
