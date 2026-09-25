// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";
import enAccount from "@/messages/en/account.json";
import type { CreditMovement } from "@/lib/dal/account";

afterEach(cleanup);

// next-intl's client hooks (useTranslations, useFormatter) work fine under
// NextIntlClientProvider in jsdom, unlike the server-only entry points
// mocked elsewhere (history-list.test.tsx's comment): MovementList is a
// plain presentational component, no server import to mock.
function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const movements: CreditMovement[] = [
  { id: "m1", createdAt: new Date("2026-09-14T10:00:00.000Z"), delta: 10, reason: "purchase" },
  { id: "m2", createdAt: new Date("2026-09-14T09:00:00.000Z"), delta: -1, reason: "generation" },
  { id: "m3", createdAt: new Date("2026-09-13T09:00:00.000Z"), delta: 1, reason: "refund" },
  { id: "m4", createdAt: new Date("2026-09-12T09:00:00.000Z"), delta: 3, reason: "signup_bonus" },
];

describe("MovementList", () => {
  it("renders each movement's signed delta and reason label, in the given order", async () => {
    const { MovementList } = await import("./movement-list");
    renderUi(<MovementList movements={movements} />);

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
    renderUi(<MovementList movements={[]} />);
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
