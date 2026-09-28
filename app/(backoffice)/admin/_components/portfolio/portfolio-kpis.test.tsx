// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import type { PortfolioMetrics } from "@/lib/dal/metrics";

afterEach(() => {
  cleanup();
  vi.resetModules();
});

// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set (see i18n/request.test.ts and the
// history-list test): mocked with a real translator, like every other
// Server Component test in this codebase.
function mockNextIntlServer(locale: "fr" | "en") {
  const messages = locale === "fr" ? fr : en;
  vi.doMock("next-intl/server", () => ({
    getTranslations: async (namespace: string) =>
      createTranslator({ locale, messages: { "backoffice-portfolio": messages }, namespace: namespace as never }),
    getLocale: async () => locale,
  }));
}

function totals(overrides: Partial<PortfolioMetrics["totals"]> = {}): PortfolioMetrics["totals"] {
  return { visits: 4200, revenueCents: 29640, aiCostMicros: 11_600_000, marginMicros: 284_800_000, ...overrides };
}

// getByText's default normalizer collapses every Unicode space (narrow
// no-break, no-break…) to a plain " " on the DOM side, but does not touch
// the string passed in: the query itself must already use a plain space
// (@testing-library/dom's `matches()`, checked directly).
describe("PortfolioKpis", () => {
  it("shows the 4 labels with their values", async () => {
    mockNextIntlServer("fr");
    const { PortfolioKpis } = await import("./portfolio-kpis");
    render(await PortfolioKpis({ totals: totals() }));
    expect(screen.getByText("Visites · 30 j")).toBeTruthy();
    expect(screen.getByText("Revenu · 30 j")).toBeTruthy();
    expect(screen.getByText("Coût IA · 30 j")).toBeTruthy();
    expect(screen.getByText("Marge brute")).toBeTruthy();
  });

  it("formats visits with a thousands separator", async () => {
    mockNextIntlServer("fr");
    const { PortfolioKpis } = await import("./portfolio-kpis");
    render(await PortfolioKpis({ totals: totals({ visits: 4200 }) }));
    expect(screen.getByText("4 200")).toBeTruthy();
  });

  it("shows an em dash for gross margin when there is no revenue", async () => {
    mockNextIntlServer("fr");
    const { PortfolioKpis } = await import("./portfolio-kpis");
    render(await PortfolioKpis({ totals: totals({ revenueCents: 0, aiCostMicros: 0, marginMicros: 0 }) }));
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("formats revenue in euros", async () => {
    mockNextIntlServer("fr");
    const { PortfolioKpis } = await import("./portfolio-kpis");
    render(await PortfolioKpis({ totals: totals({ revenueCents: 2470 }) }));
    expect(screen.getByText("24,70 €")).toBeTruthy();
  });

  it("shows the 4 labels and formats revenue in English", async () => {
    mockNextIntlServer("en");
    const { PortfolioKpis } = await import("./portfolio-kpis");
    render(await PortfolioKpis({ totals: totals({ revenueCents: 2470 }) }));
    expect(screen.getByText("Visits · 30 d")).toBeTruthy();
    expect(screen.getByText("Revenue · 30 d")).toBeTruthy();
    expect(screen.getByText("AI cost · 30 d")).toBeTruthy();
    expect(screen.getByText("Gross margin")).toBeTruthy();
    expect(screen.getByText("€24.70")).toBeTruthy();
  });
});
