// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ActivityGeneration } from "@/lib/dal/activity";
import { GenerationsTable } from "./generations-table";

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
  it("shows an empty state when there is no generation at all", () => {
    render(
      <GenerationsTable
        slug="s"
        entries={[]}
        total={0}
        page={1}
        hasMore={false}
        fields={fields}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("Aucune génération pour l'instant")).toBeTruthy();
  });

  it("shows a dedicated empty state for an out-of-range page", () => {
    render(
      <GenerationsTable
        slug="s"
        entries={[]}
        total={5}
        page={3}
        hasMore={false}
        fields={fields}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("Page vide")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revenir à la première page" })).toBeTruthy();
  });

  it("shows date, input, output and cost for a succeeded generation", () => {
    render(
      <GenerationsTable
        slug="s"
        entries={[entry()]}
        total={1}
        page={1}
        hasMore={false}
        fields={fields}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("il y a 2 min")).toBeTruthy();
    expect(screen.getByText("Secteur : café · Ton : ludique")).toBeTruthy();
    expect(screen.getByText("Brewtiful, Grain Gang, Moka")).toBeTruthy();
    expect(screen.getByText(/^0,004.€$/)).toBeTruthy();
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("shows an em dash and the error status for a failed, refunded generation", () => {
    render(
      <GenerationsTable
        slug="s"
        entries={[entry({ status: "failed", refunded: true, output: null, costMicros: null })]}
        total={1}
        page={1}
        hasMore={false}
        fields={fields}
        now={now}
        currentPages={{}}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Erreur · remboursé")).toBeTruthy();
  });
});
