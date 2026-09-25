// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";

afterEach(cleanup);

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const getBalance = vi.fn();
vi.mock("@/lib/dal/credits", () => ({ getBalance: (...args: unknown[]) => getBalance(...args) }));

const listCreditMovements = vi.fn();
const listPurchases = vi.fn();
vi.mock("@/lib/dal/account", () => ({
  listCreditMovements: (...args: unknown[]) => listCreditMovements(...args),
  listPurchases: (...args: unknown[]) => listPurchases(...args),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "account") =>
    createTranslator({ locale: "fr", messages: { account: frAccount }, namespace }),
}));

const movementListSpy = vi.fn();
vi.mock("./movement-list", () => ({
  MovementList: (props: unknown) => {
    movementListSpy(props);
    return <div data-testid="movement-list-stub" />;
  },
}));

const purchaseListSpy = vi.fn();
vi.mock("./purchase-list", () => ({
  PurchaseList: (props: unknown) => {
    purchaseListSpy(props);
    return <div data-testid="purchase-list-stub" />;
  },
}));

vi.mock("./sign-out-button", () => ({
  AccountSignOutButton: () => <button type="button">Se déconnecter</button>,
}));

const signupPromptSpy = vi.fn();
vi.mock("./signup-prompt", () => ({
  SignupPrompt: (props: unknown) => {
    signupPromptSpy(props);
    return <div data-testid="signup-prompt-stub" />;
  },
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AccountContent — not signed in", () => {
  afterEach(() => {
    getSession.mockReset();
    getBalance.mockReset();
    listCreditMovements.mockReset();
    listPurchases.mockReset();
    signupPromptSpy.mockReset();
  });

  it("renders SignupPrompt and calls no DAL function", async () => {
    getSession.mockResolvedValue(null);
    const { AccountContent } = await import("./account-content");
    const ui = await AccountContent({ slug: "nom-de-marque", productId: "product-1" });
    renderUi(ui);

    expect(screen.getByTestId("signup-prompt-stub")).toBeTruthy();
    expect(signupPromptSpy).toHaveBeenCalledWith({ slug: "nom-de-marque" });
    expect(getBalance).not.toHaveBeenCalled();
    expect(listCreditMovements).not.toHaveBeenCalled();
    expect(listPurchases).not.toHaveBeenCalled();
  });
});

describe("AccountContent — signed in", () => {
  afterEach(() => {
    getSession.mockReset();
    getBalance.mockReset();
    listCreditMovements.mockReset();
    listPurchases.mockReset();
    movementListSpy.mockReset();
    purchaseListSpy.mockReset();
  });

  it("reads the session user's own balance, movements and purchases, and renders them", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", email: "lea@exemple.fr" } });
    getBalance.mockResolvedValue(12);
    const movements = [{ id: "m1", createdAt: new Date(), delta: 3, reason: "signup_bonus" }];
    const purchases = [{ id: "p1", createdAt: new Date(), credits: 10, amountCents: 490, currency: "EUR" }];
    listCreditMovements.mockResolvedValue(movements);
    listPurchases.mockResolvedValue(purchases);

    const { AccountContent } = await import("./account-content");
    const ui = await AccountContent({ slug: "nom-de-marque", productId: "product-1" });
    renderUi(ui);

    expect(getBalance).toHaveBeenCalledWith("user-1", "product-1");
    expect(listCreditMovements).toHaveBeenCalledWith("user-1", "product-1");
    expect(listPurchases).toHaveBeenCalledWith("user-1", "product-1");

    expect(screen.getByText("lea@exemple.fr")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Recharger" })).toHaveProperty(
      "href",
      expect.stringContaining("/nom-de-marque/pricing"),
    );
    expect(screen.getByTestId("movement-list-stub")).toBeTruthy();
    expect(movementListSpy).toHaveBeenCalledWith({ movements });
    expect(screen.getByTestId("purchase-list-stub")).toBeTruthy();
    expect(purchaseListSpy).toHaveBeenCalledWith({ purchases });
    expect(screen.getByRole("link", { name: "Voir mes générations" })).toHaveProperty(
      "href",
      expect.stringContaining("/nom-de-marque/history"),
    );
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
  });
});
