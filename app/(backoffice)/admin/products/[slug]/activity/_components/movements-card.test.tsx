// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { ActivityMovement } from "@/lib/dal/activity";

// MovementsCard and the PaginationNav it nests are Server Components: mocked
// with a real translator, like every other Server Component of this lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
}));

afterEach(cleanup);

const now = new Date("2026-01-01T12:00:00.000Z");

function movement(overrides: Partial<ActivityMovement> = {}): ActivityMovement {
  return {
    id: "m1",
    createdAt: new Date("2026-01-01T11:58:00.000Z"),
    delta: 10,
    reason: "purchase",
    packCredits: 10,
    ...overrides,
  };
}

describe("MovementsCard", () => {
  it("shows an empty state when there is no movement at all", async () => {
    const { MovementsCard } = await import("./movements-card");
    render(await MovementsCard({ slug: "s", entries: [], total: 0, page: 1, hasMore: false, now, currentPages: {} }));
    expect(screen.getByText("Aucun mouvement pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", async () => {
    const { MovementsCard } = await import("./movements-card");
    render(await MovementsCard({ slug: "s", entries: [], total: 5, page: 3, hasMore: false, now, currentPages: {} }));
    expect(screen.getByText("Page vide")).toBeTruthy();
  });

  it("shows the signed delta, label and relative date for each movement", async () => {
    const { MovementsCard } = await import("./movements-card");
    render(
      await MovementsCard({
        slug: "s",
        entries: [
          movement({ delta: 10, reason: "purchase", packCredits: 10 }),
          movement({
            id: "m2",
            delta: -1,
            reason: "generation",
            packCredits: null,
            createdAt: new Date("2026-01-01T11:58:00.000Z"),
          }),
          movement({ id: "m3", delta: 1, reason: "refund", packCredits: null }),
          movement({ id: "m4", delta: 3, reason: "signup_bonus", packCredits: null }),
        ],
        total: 4,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("+10")).toBeTruthy();
    expect(screen.getByText("Achat pack 10")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(screen.getByText("Génération")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.getByText("Remboursement")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("Bonus inscription")).toBeTruthy();
  });

  it("renders the title, reason labels and relative date in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
    }));
    vi.resetModules();
    const { MovementsCard } = await import("./movements-card");
    render(
      await MovementsCard({
        slug: "s",
        entries: [movement({ delta: 10, reason: "purchase", packCredits: 10 })],
        total: 1,
        page: 1,
        hasMore: false,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Credit movements")).toBeTruthy();
    expect(screen.getByText("Pack 10 purchase")).toBeTruthy();
    expect(screen.getByText("2 min ago")).toBeTruthy();
  });
});
