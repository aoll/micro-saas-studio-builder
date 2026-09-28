// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frDecision from "@/messages/fr/backoffice-decision.json";
import enDecision from "@/messages/en/backoffice-decision.json";
import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";

afterEach(cleanup);

// DecisionGauge is a Server Component (no interactivity, pure geometry +
// text), so this test calls it directly (async, movement-list.test.tsx's
// pattern) instead of rendering it under NextIntlClientProvider.
// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set: mocked with a real translator per
// locale, and a formatter built from Intl directly (I18N-BACKOFFICE-STRINGS
// lot 3: decision-gauge.tsx used to hard-code `.toLocaleString("fr-FR")`).
function mockNextIntlServer(locale: "fr" | "en") {
  const messages = locale === "fr" ? frDecision : enDecision;
  vi.doMock("next-intl/server", () => ({
    getTranslations: async (namespace: "backoffice-decision") =>
      createTranslator({ locale, messages: { "backoffice-decision": messages }, namespace }),
    getFormatter: async () => ({
      number: (value: number) => new Intl.NumberFormat(locale).format(value),
    }),
  }));
}

const thresholds: Thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};

describe("DecisionGauge", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("next-intl/server");
  });

  it("renders the threshold gauge with a marker for the current conversion rate", async () => {
    mockNextIntlServer("fr");
    const { DecisionGauge } = await import("./decision-gauge");
    const metrics: DecisionMetrics = { visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

    render(await DecisionGauge({ metrics, thresholds }));

    expect(screen.getByTestId("gauge-marker")).toBeTruthy();
  });

  it("shows the visits-gate note below minVisits, in French", async () => {
    mockNextIntlServer("fr");
    const { DecisionGauge } = await import("./decision-gauge");
    const metrics: DecisionMetrics = { visits: 400, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

    render(await DecisionGauge({ metrics, thresholds }));

    expect(screen.getByText(/Seuil de visites non atteint/)).toBeTruthy();
  });

  it("shows the visits-gate note in English when the locale resolves to en", async () => {
    mockNextIntlServer("en");
    const { DecisionGauge } = await import("./decision-gauge");
    const metrics: DecisionMetrics = { visits: 400, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

    render(await DecisionGauge({ metrics, thresholds }));

    expect(screen.getByText(/Visit threshold not reached/)).toBeTruthy();
  });

  it("shows the canonical cut / neutral zone / scale legend, translated", async () => {
    mockNextIntlServer("en");
    const { DecisionGauge } = await import("./decision-gauge");
    const metrics: DecisionMetrics = { visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

    render(await DecisionGauge({ metrics, thresholds }));

    expect(screen.getByText("cut")).toBeTruthy();
    expect(screen.getByText("neutral zone")).toBeTruthy();
    expect(screen.getByText("scale")).toBeTruthy();
  });

  it("labels the axis image with the translated aria-label", async () => {
    mockNextIntlServer("en");
    const { DecisionGauge } = await import("./decision-gauge");
    const metrics: DecisionMetrics = { visits: 1200, signupToPurchaseRate: 0.07, marginPerGenerationMicros: 500_000 };

    render(await DecisionGauge({ metrics, thresholds }));

    expect(screen.getByRole("img", { name: "Position relative to the decision thresholds" })).toBeTruthy();
  });
});
