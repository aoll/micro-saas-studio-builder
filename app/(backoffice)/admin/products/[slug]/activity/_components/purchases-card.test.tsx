// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { ActivityPurchase, PurchaseSummary } from "@/lib/dal/activity";

// PurchasesCard and the PaginationNav it nests are Server Components: mocked
// with a real translator, like every other Server Component of this lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

afterEach(cleanup);

const now = new Date("2026-01-01T12:00:00.000Z");

const zeroSummary: PurchaseSummary = { count: 0, revenueCents: 0, byPack: [] };

function purchase(overrides: Partial<ActivityPurchase> = {}): ActivityPurchase {
  return {
    id: "p1",
    createdAt: new Date("2026-01-01T11:00:00.000Z"),
    credits: 10,
    amountCents: 490,
    currency: "EUR",
    ...overrides,
  };
}

describe("PurchasesCard", () => {
  it("shows the mockup's summary line and pack breakdown", async () => {
    const summary: PurchaseSummary = {
      count: 14,
      revenueCents: 7_200,
      byPack: [
        { credits: 10, count: 11 },
        { credits: 50, count: 3 },
      ],
    };
    const { PurchasesCard } = await import("./purchases-card");
    render(
      await PurchasesCard({
        slug: "s",
        summary,
        entries: [purchase()],
        total: 1,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText(/^14 achats.+72,00.€$/)).toBeTruthy();
    expect(screen.getByText("Pack 10 : 11 · Pack 50 : 3")).toBeTruthy();
  });

  it("shows an empty state for the list when there is no purchase at all", async () => {
    const { PurchasesCard } = await import("./purchases-card");
    render(
      await PurchasesCard({
        slug: "s",
        summary: zeroSummary,
        entries: [],
        total: 0,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Aucun achat pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", async () => {
    const { PurchasesCard } = await import("./purchases-card");
    render(
      await PurchasesCard({
        slug: "s",
        summary: zeroSummary,
        entries: [],
        total: 5,
        page: 3,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Page vide")).toBeTruthy();
  });

  it("lists each purchase's credits, price and relative date", async () => {
    const { PurchasesCard } = await import("./purchases-card");
    render(
      await PurchasesCard({
        slug: "s",
        summary: zeroSummary,
        entries: [purchase({ credits: 50, amountCents: 1490 })],
        total: 1,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("+50")).toBeTruthy();
    expect(screen.getByText(/^14,90.€$/)).toBeTruthy();
    expect(screen.getByText("il y a 1 h")).toBeTruthy();
  });

  it("renders the title, summary pluralization and relative date in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    const summary: PurchaseSummary = { count: 1, revenueCents: 490, byPack: [] };
    const { PurchasesCard } = await import("./purchases-card");
    render(
      await PurchasesCard({
        slug: "s",
        summary,
        entries: [purchase()],
        total: 1,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Purchases · 30d")).toBeTruthy();
    expect(screen.getByText(/^1 purchase.+4,90.€$/)).toBeTruthy();
    expect(screen.getByText("1h ago")).toBeTruthy();
  });
});
