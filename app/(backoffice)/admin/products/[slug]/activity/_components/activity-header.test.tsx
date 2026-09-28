// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";

// ActivityHeader nests ProductTabs, whose two labels it now resolves itself
// (product-tabs.tsx's comment): mocked with a real translator, like the
// other Server Components of this lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

afterEach(cleanup);

describe("ActivityHeader", () => {
  it("shows the product name and status", async () => {
    const { ActivityHeader } = await import("./activity-header");
    render(await ActivityHeader({ slug: "nom-de-marque", name: "NomDeMarque", status: "test" }));
    expect(screen.getByRole("heading", { name: "NomDeMarque" })).toBeTruthy();
    expect(screen.getByTestId("status-badge")).toBeTruthy();
  });

  it("links Vue d'ensemble to the sheet and Activité to itself, Activité marked current", async () => {
    const { ActivityHeader } = await import("./activity-header");
    render(await ActivityHeader({ slug: "nom-de-marque", name: "NomDeMarque", status: "test" }));
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.getAttribute("href")).toBe("/admin/products/nom-de-marque");
    expect(activity.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity");
    expect(activity.className).toContain("border-foreground");
    expect(overview.className).not.toContain("border-foreground");
  });

  it("renders the tabs in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    const { ActivityHeader } = await import("./activity-header");
    render(await ActivityHeader({ slug: "nom-de-marque", name: "NomDeMarque", status: "test" }));
    expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Activity" })).toBeTruthy();
  });
});
