// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ listProducts }));

function product(overrides: Partial<{ slug: string; name: string; status: string; headline: string }> = {}) {
  return {
    slug: "lettre-pro",
    name: "LettrePro",
    status: "scale",
    landing: { headline: overrides.headline ?? "Générez votre lettre de motivation en 30 secondes" },
    ...overrides,
  };
}

// Same pattern as app/(products)/_components/product-not-found.test.tsx:
// jsdom can't render an async Server Component, so the async function is
// called directly and its resolved JSX handed to Testing Library.
describe("ProductsShowcase", () => {
  it("links to every non-killed product, sorted by name", async () => {
    listProducts.mockResolvedValue([
      product({ slug: "nom-de-marque", name: "NomDeMarque", status: "test", headline: "Des noms de marque en 1 clic" }),
      product({
        slug: "lettre-pro",
        name: "LettrePro",
        status: "scale",
        headline: "Générez votre lettre de motivation en 30 secondes",
      }),
      product({ slug: "descri-pro", name: "DescriPro", status: "learn", headline: "Décrivez vos produits en un clic" }),
    ]);
    const { ProductsShowcase } = await import("./products-showcase");
    render(await ProductsShowcase());
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/descri-pro", "/lettre-pro", "/nom-de-marque"]);
    expect(screen.getByText("Générez votre lettre de motivation en 30 secondes")).toBeTruthy();
  });

  it("excludes killed products, never linking or naming them", async () => {
    listProducts.mockResolvedValue([
      product({ slug: "lettre-pro", name: "LettrePro", status: "scale" }),
      product({ slug: "nom-de-marque", name: "NomDeMarque", status: "killed" }),
    ]);
    const { ProductsShowcase } = await import("./products-showcase");
    render(await ProductsShowcase());
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/lettre-pro"]);
    expect(screen.queryByText("NomDeMarque")).toBeNull();
  });

  it("renders nothing when every product is killed", async () => {
    listProducts.mockResolvedValue([product({ status: "killed" })]);
    const { ProductsShowcase } = await import("./products-showcase");
    const result = await ProductsShowcase();
    expect(result).toBeNull();
  });
});
