// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frAccount from "@/messages/fr/account.json";
import enAccount from "@/messages/en/account.json";
import type { CreditMovement } from "@/lib/dal/account";

afterEach(cleanup);

// MovementList has no interactivity (review fix, MEDIUM): a Server
// Component like history-list.tsx, not a 'use client' leaf, so this test
// calls it directly (async, like signup-prompt.test.tsx) instead of
// rendering it under NextIntlClientProvider. next-intl/server picks its
// "react-server" export via a condition Vitest's node/jsdom environments
// don't set (history-list.test.tsx's comment): mocked with a real
// translator, and a formatter built from Intl directly.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "account") =>
    createTranslator({ locale: "fr", messages: { account: frAccount }, namespace }),
  getFormatter: async () => ({
    dateTime: (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr", options).format(date),
  }),
}));

const movements: CreditMovement[] = [
  { id: "m1", createdAt: new Date("2026-09-14T10:00:00.000Z"), delta: 10, reason: "purchase" },
  { id: "m2", createdAt: new Date("2026-09-14T09:00:00.000Z"), delta: -1, reason: "generation" },
  { id: "m3", createdAt: new Date("2026-09-13T09:00:00.000Z"), delta: 1, reason: "refund" },
  { id: "m4", createdAt: new Date("2026-09-12T09:00:00.000Z"), delta: 3, reason: "signup_bonus" },
];

describe("MovementList", () => {
  it("renders each movement's signed delta and reason label, in the given order", async () => {
    const { MovementList } = await import("./movement-list");
    const ui = await MovementList({ movements });
    render(ui);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]!.textContent).toContain("+10");
    expect(items[0]!.textContent).toContain("Achat pack 10 crédits");
    expect(items[1]!.textContent).toContain("−1");
    expect(items[1]!.textContent).toContain("Génération");
    expect(items[2]!.textContent).toContain("+1");
    expect(items[2]!.textContent).toContain("Remboursement (échec)");
    expect(items[3]!.textContent).toContain("+3");
    expect(items[3]!.textContent).toContain("Bonus d'inscription");
  });

  it("shows the empty state when there is no movement", async () => {
    const { MovementList } = await import("./movement-list");
    const ui = await MovementList({ movements: [] });
    render(ui);
    expect(screen.getByText("Aucun mouvement pour le moment")).toBeTruthy();
  });
});

describe("account.json — fr/en key parity", () => {
  function keyPaths(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
  }

  it("has identical key paths in fr and en", () => {
    expect(keyPaths(frAccount).sort()).toEqual(keyPaths(enAccount).sort());
  });
});
