// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ActivityPurchase, PurchaseSummary } from "@/lib/dal/activity";
import { PurchasesCard } from "./purchases-card";

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
  it("shows the mockup's summary line and pack breakdown", () => {
    const summary: PurchaseSummary = {
      count: 14,
      revenueCents: 7_200,
      byPack: [
        { credits: 10, count: 11 },
        { credits: 50, count: 3 },
      ],
    };
    render(
      <PurchasesCard
        slug="s"
        summary={summary}
        entries={[purchase()]}
        total={1}
        page={1}
        hasMore={false}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText(/^14 achats.+72,00.€$/)).toBeTruthy();
    expect(screen.getByText("Pack 10 : 11 · Pack 50 : 3")).toBeTruthy();
  });

  it("shows an empty state for the list when there is no purchase at all", () => {
    render(
      <PurchasesCard
        slug="s"
        summary={zeroSummary}
        entries={[]}
        total={0}
        page={1}
        hasMore={false}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("Aucun achat pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", () => {
    render(
      <PurchasesCard
        slug="s"
        summary={zeroSummary}
        entries={[]}
        total={5}
        page={3}
        hasMore={false}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("Page vide")).toBeTruthy();
  });

  it("lists each purchase's credits, price and relative date", () => {
    render(
      <PurchasesCard
        slug="s"
        summary={zeroSummary}
        entries={[purchase({ credits: 50, amountCents: 1490 })]}
        total={1}
        page={1}
        hasMore={false}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("+50")).toBeTruthy();
    expect(screen.getByText(/^14,90.€$/)).toBeTruthy();
    expect(screen.getByText("il y a 1 h")).toBeTruthy();
  });
});
