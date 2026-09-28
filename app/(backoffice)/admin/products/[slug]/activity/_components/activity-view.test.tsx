// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { ActivityPage, ActivityGeneration, ActivityMovement, ActivityPurchase } from "@/lib/dal/activity";

// ActivityView nests four Server Components (ActivityHeader, GenerationsTable, MovementsCard,
// PurchasesCard): mocked with a real translator, like every other Server Component of this lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

afterEach(cleanup);

const now = new Date("2026-01-01T12:00:00.000Z");

function emptyPage<T>(page = 1): ActivityPage<T> {
  return { entries: [], page, total: 0, hasMore: false };
}

async function renderView() {
  const { ActivityView } = await import("./activity-view");
  return render(
    await ActivityView({
      slug: "nom-de-marque",
      name: "NomDeMarque",
      status: "test",
      fields: [],
      generations: emptyPage<ActivityGeneration>(),
      movements: emptyPage<ActivityMovement>(),
      purchases: emptyPage<ActivityPurchase>(),
      purchaseSummary: { count: 0, revenueCents: 0, byPack: [] },
      now,
    }),
  );
}

describe("ActivityView", () => {
  it("renders the header and the three list cards", async () => {
    await renderView();
    expect(screen.getByRole("heading", { name: "NomDeMarque" })).toBeTruthy();
    expect(screen.getByText("Dernières générations")).toBeTruthy();
    expect(screen.getByText("Mouvements de crédits")).toBeTruthy();
    expect(screen.getByText("Achats · 30 j")).toBeTruthy();
  });

  it("shows each list's own empty state independently", async () => {
    await renderView();
    expect(screen.getByText("Aucune génération pour l'instant")).toBeTruthy();
    expect(screen.getByText("Aucun mouvement pour l'instant")).toBeTruthy();
    expect(screen.getByText("Aucun achat pour l'instant")).toBeTruthy();
  });

  it("renders every card's title in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    await renderView();
    expect(screen.getByText("Latest generations")).toBeTruthy();
    expect(screen.getByText("Credit movements")).toBeTruthy();
    expect(screen.getByText("Purchases · 30d")).toBeTruthy();
  });
});
