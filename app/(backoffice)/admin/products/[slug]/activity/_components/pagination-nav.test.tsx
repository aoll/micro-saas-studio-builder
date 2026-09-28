// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";

// PaginationNav is a Server Component (no interactivity): mocked with a real
// translator, like every other Server Component of this lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

afterEach(cleanup);

describe("PaginationNav", () => {
  it("renders nothing on a single, full page (page 1, no more)", async () => {
    const { PaginationNav } = await import("./pagination-nav");
    const { container } = render(
      await PaginationNav({ slug: "nom-de-marque", listKey: "generations", page: 1, hasMore: false, currentPages: {} }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows only Suivant on the first page when there is more", async () => {
    const { PaginationNav } = await import("./pagination-nav");
    render(
      await PaginationNav({ slug: "nom-de-marque", listKey: "generations", page: 1, hasMore: true, currentPages: {} }),
    );
    expect(screen.getByRole("link", { name: "Suivant" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Précédent" })).toBeNull();
  });

  it("shows only Précédent on the last page", async () => {
    const { PaginationNav } = await import("./pagination-nav");
    render(
      await PaginationNav({ slug: "nom-de-marque", listKey: "generations", page: 2, hasMore: false, currentPages: {} }),
    );
    expect(screen.getByRole("link", { name: "Précédent" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Suivant" })).toBeNull();
  });

  it("keeps the other lists' pages when linking Suivant", async () => {
    const { PaginationNav } = await import("./pagination-nav");
    render(
      await PaginationNav({
        slug: "nom-de-marque",
        listKey: "movements",
        page: 1,
        hasMore: true,
        currentPages: { generations: 3, purchases: 2 },
      }),
    );
    const link = screen.getByRole("link", { name: "Suivant" });
    expect(link.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity?genPage=3&purPage=2&movPage=2");
  });

  it("renders Previous/Next in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    const { PaginationNav } = await import("./pagination-nav");
    render(
      await PaginationNav({ slug: "nom-de-marque", listKey: "generations", page: 2, hasMore: true, currentPages: {} }),
    );
    expect(screen.getByRole("link", { name: "Previous" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next" })).toBeTruthy();
  });
});
