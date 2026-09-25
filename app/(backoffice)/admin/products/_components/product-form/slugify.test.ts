import { describe, expect, it } from "vitest";
import { slugSchema } from "@/lib/schemas/product-config";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("removes accents and lowercases", () => {
    expect(slugify("Générateur de bio Instagram")).toBe("generateur-de-bio-instagram");
  });

  it("strips punctuation and collapses surrounding whitespace", () => {
    expect(slugify("  L'Été  2026!! ")).toBe("l-ete-2026");
  });

  it("returns an empty string for a name with no keepable character", () => {
    expect(slugify("---")).toBe("");
  });

  it("truncates to at most 60 characters without a trailing dash", () => {
    const long = "mot ".repeat(30); // 120 chars once joined by dashes
    const slug = slugify(long);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("produces slugs the shared schema accepts (reserved words aside)", () => {
    for (const name of ["Générateur de bio Instagram", "Lettre de motivation 2", "NomDeMarque"]) {
      expect(slugSchema.safeParse(slugify(name)).success).toBe(true);
    }
  });
});
