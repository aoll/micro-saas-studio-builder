// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frSheet from "@/messages/fr/backoffice-product-sheet.json";
import enSheet from "@/messages/en/backoffice-product-sheet.json";
import type { ActivityGeneration } from "@/lib/dal/activity";

// GenerationsTable and the PaginationNav it nests are Server Components:
// mocked with a real translator, like every other Server Component of this
// lot.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-product-sheet") =>
    createTranslator({ locale: "fr", messages: { "backoffice-product-sheet": frSheet }, namespace }),
  getLocale: async () => "fr",
}));

afterEach(cleanup);

const now = new Date("2026-01-01T12:00:00.000Z");
const fields = [
  { key: "sector", label: "Secteur" },
  { key: "tone", label: "Ton" },
];

function entry(overrides: Partial<ActivityGeneration> = {}): ActivityGeneration {
  return {
    id: "gen-1",
    createdAt: new Date("2026-01-01T11:58:00.000Z"),
    input: { sector: "café", tone: "ludique" },
    output: ["Brewtiful", "Grain Gang", "Moka"],
    model: "anthropic/claude-haiku-4.5",
    costMicros: 4_000,
    status: "succeeded",
    refunded: false,
    ...overrides,
  };
}

describe("GenerationsTable", () => {
  it("shows an empty state when there is no generation at all", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [],
        total: 0,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Aucune génération pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [],
        total: 5,
        page: 3,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Page vide")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revenir à la première page" })).toBeTruthy();
  });

  it("shows date, input, output and cost for a succeeded generation", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [entry()],
        total: 1,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("il y a 2 min")).toBeTruthy();
    expect(screen.getByText("Secteur : café · Ton : ludique")).toBeTruthy();
    expect(screen.getByText("Brewtiful, Grain Gang, Moka")).toBeTruthy();
    expect(screen.getByText(/^0,004.€$/)).toBeTruthy();
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("shows an em dash and the error status for a failed, refunded generation", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [entry({ status: "failed", refunded: true, output: null, costMicros: null })],
        total: 1,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Erreur · remboursé")).toBeTruthy();
  });

  it("shows the model that answered in a Modèle column (spec BO-04: entrée, sortie, modèle, coût)", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [entry()],
        total: 1,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByRole("columnheader", { name: "Modèle" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "anthropic/claude-haiku-4.5" })).toBeTruthy();
  });

  it("shows an em dash when no model is recorded", async () => {
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [entry({ model: null })],
        total: 1,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByRole("cell", { name: "—" })).toBeTruthy();
  });

  it("renders the title, columns, status and relative time in English", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: "backoffice-product-sheet") =>
        createTranslator({ locale: "en", messages: { "backoffice-product-sheet": enSheet }, namespace }),
      getLocale: async () => "en",
    }));
    vi.resetModules();
    const { GenerationsTable } = await import("./generations-table");
    render(
      await GenerationsTable({
        slug: "s",
        entries: [entry()],
        total: 1,
        page: 1,
        hasMore: false,
        fields,
        now,
        currentPages: {},
      }),
    );
    expect(screen.getByText("Latest generations")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Model" })).toBeTruthy();
    expect(screen.getByText("2 min ago")).toBeTruthy();
    expect(screen.getByText("OK")).toBeTruthy();
  });
});
