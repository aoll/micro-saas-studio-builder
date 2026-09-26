import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_URL: "https://studio.example.com/" } }));

const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ listProducts }));

function product(overrides: Partial<{ slug: string; status: string }>) {
  return { slug: "lettre-pro", status: "test", ...overrides };
}

describe("sitemap", () => {
  it("lists the root landing and every non-killed product", async () => {
    listProducts.mockResolvedValue([
      product({ slug: "lettre-pro", status: "test" }),
      product({ slug: "descri-pro", status: "learn" }),
      product({ slug: "nom-de-marque", status: "scale" }),
    ]);
    const { default: sitemap } = await import("./sitemap");
    const result = await sitemap();
    expect(result.map((entry) => entry.url).sort()).toEqual([
      "https://studio.example.com",
      "https://studio.example.com/descri-pro",
      "https://studio.example.com/lettre-pro",
      "https://studio.example.com/nom-de-marque",
    ]);
  });

  it("excludes killed products", async () => {
    listProducts.mockResolvedValue([product({ slug: "killed-one", status: "killed" })]);
    const { default: sitemap } = await import("./sitemap");
    const result = await sitemap();
    expect(result).toEqual([{ url: "https://studio.example.com" }]);
  });

  it("keeps only the root landing when there are no products", async () => {
    listProducts.mockResolvedValue([]);
    const { default: sitemap } = await import("./sitemap");
    const result = await sitemap();
    expect(result).toEqual([{ url: "https://studio.example.com" }]);
  });
});
