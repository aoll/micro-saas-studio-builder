// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ActivityMovement } from "@/lib/dal/activity";
import { MovementsCard } from "./movements-card";

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
  it("shows an empty state when there is no movement at all", () => {
    render(<MovementsCard slug="s" entries={[]} total={0} page={1} hasMore={false} now={now} currentPages={{}} />);
    expect(screen.getByText("Aucun mouvement pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", () => {
    render(<MovementsCard slug="s" entries={[]} total={5} page={3} hasMore={false} now={now} currentPages={{}} />);
    expect(screen.getByText("Page vide")).toBeTruthy();
  });

  it("shows the signed delta, label and relative date for each movement", () => {
    render(
      <MovementsCard
        slug="s"
        entries={[
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
        ]}
        total={4}
        page={1}
        hasMore={false}
        now={now}
        currentPages={{}}
      />,
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
});
