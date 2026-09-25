// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ActivityPage, ActivityGeneration, ActivityMovement, ActivityPurchase } from "@/lib/dal/activity";
import { ActivityView } from "./activity-view";

afterEach(cleanup);

const now = new Date("2026-01-01T12:00:00.000Z");

function emptyPage<T>(page = 1): ActivityPage<T> {
  return { entries: [], page, total: 0, hasMore: false };
}

describe("ActivityView", () => {
  it("renders the header and the three list cards", () => {
    render(
      <ActivityView
        slug="nom-de-marque"
        name="NomDeMarque"
        status="test"
        fields={[]}
        generations={emptyPage<ActivityGeneration>()}
        movements={emptyPage<ActivityMovement>()}
        purchases={emptyPage<ActivityPurchase>()}
        purchaseSummary={{ count: 0, revenueCents: 0, byPack: [] }}
        now={now}
      />,
    );
    expect(screen.getByRole("heading", { name: "NomDeMarque" })).toBeTruthy();
    expect(screen.getByText("Dernières générations")).toBeTruthy();
    expect(screen.getByText("Mouvements de crédits")).toBeTruthy();
    expect(screen.getByText("Achats · 30 j")).toBeTruthy();
  });

  it("shows each list's own empty state independently", () => {
    render(
      <ActivityView
        slug="nom-de-marque"
        name="NomDeMarque"
        status="test"
        fields={[]}
        generations={emptyPage<ActivityGeneration>()}
        movements={emptyPage<ActivityMovement>()}
        purchases={emptyPage<ActivityPurchase>()}
        purchaseSummary={{ count: 0, revenueCents: 0, byPack: [] }}
        now={now}
      />,
    );
    expect(screen.getByText("Aucune génération pour l'instant")).toBeTruthy();
    expect(screen.getByText("Aucun mouvement pour l'instant")).toBeTruthy();
    expect(screen.getByText("Aucun achat pour l'instant")).toBeTruthy();
  });
});
