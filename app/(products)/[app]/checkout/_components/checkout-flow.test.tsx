// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen, waitFor } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import checkoutFr from "@/messages/fr/checkout.json";
import { BalanceBadge, BalanceProvider } from "@/components/product/balance";
import type { Pack } from "@/lib/schemas/pack";
import { CheckoutFlow } from "./checkout-flow";

const replace = vi.fn();
const back = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, back, refresh }) }));

const purchase = vi.fn();
vi.mock("../_actions", () => ({
  purchase: (slug: string, packId: string, key: string) => purchase(slug, packId, key),
}));

afterEach(() => {
  cleanup();
  replace.mockClear();
  back.mockClear();
  refresh.mockClear();
  purchase.mockReset();
});

const pack: Pack = { id: "pack-50", credits: 50, priceCents: 1490, recommended: true };

/** A promise plus its own resolve/reject, to control when the mocked purchase() settles. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderFlow(variant: "modal" | "page", balance = 0) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, checkout: checkoutFr }}>
      <BalanceProvider>
        <BalanceBadge balance={balance} />
        <CheckoutFlow variant={variant} slug="bio-insta" productName="BioInsta" pack={pack} costPerGeneration={1} />
      </BalanceProvider>
    </NextIntlClientProvider>,
  );
}

describe("CheckoutFlow — idle state", () => {
  it("shows the pack summary, the test card and the pay button with the price", () => {
    renderFlow("page");
    expect(screen.getByText("BioInsta · pack")).toBeTruthy();
    expect(screen.getByLabelText("Carte").getAttribute("value")).toBe("4242 4242 4242 4242");
    expect(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" })).toBeTruthy();
    expect(screen.getByText("Paiement simulé pour la démo · aucun montant n'est débité")).toBeTruthy();
  });
});

describe("CheckoutFlow — submit and pending", () => {
  it("calls purchase with the slug, the pack id and a fresh uuid key, applies the optimistic delta, and disables the button", async () => {
    const { promise, resolve } = deferred<{ ok: true; balance: number }>();
    purchase.mockReturnValue(promise);
    renderFlow("page", 5);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));

    expect(purchase).toHaveBeenCalledTimes(1);
    const [slug, packId, key] = purchase.mock.calls[0] as [string, string, string];
    expect(slug).toBe("bio-insta");
    expect(packId).toBe("pack-50");
    expect(key).toMatch(/^[0-9a-f-]{36}$/);

    expect(screen.getByText("55 crédits")).toBeTruthy();
    const button = screen.getByRole("button", { name: /Paiement en cours/ });
    expect(button.hasAttribute("disabled")).toBe(true);

    // Settles the transition this test started (never awaited otherwise):
    // an unresolved purchase() promise would otherwise leak into later
    // tests as a still-pending React transition.
    resolve({ ok: true, balance: 55 });
    await screen.findByText("+50 crédits");
  });

  it("does not call purchase twice on a double click", async () => {
    const { promise, resolve } = deferred<{ ok: true; balance: number }>();
    purchase.mockReturnValue(promise);
    renderFlow("page");

    const button = screen.getByRole("button", { name: "Payer 14,90 € (simulé)" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(purchase).toHaveBeenCalledTimes(1);

    resolve({ ok: true, balance: 0 });
    await screen.findByText("+50 crédits");
  });
});

describe("CheckoutFlow — confirmation", () => {
  it("shows the confirmation with the new balance and resumes to the tool", async () => {
    purchase.mockResolvedValue({ ok: true, balance: 50 });
    renderFlow("page", 0);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));

    await screen.findByText("+50 crédits");
    expect(screen.getByText("Ajoutés à votre compte")).toBeTruthy();
    expect(screen.getByText("14,90 €")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma génération →" }));
    expect(replace).toHaveBeenCalledWith("/bio-insta/tool");
  });

  it("shows the modal-confirmed title in the modal variant", async () => {
    purchase.mockResolvedValue({ ok: true, balance: 50 });
    renderFlow("modal", 0);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));

    await screen.findByText("+50 crédits");
    expect(screen.getByRole("dialog").textContent).toContain("Paiement confirmé");
  });
});

// QA1-P1-B3 (.claude/qa/reports/2026-09-25-full.md › B3,
// .claude/plans/QA1-P1-B3.plan.md step 2): no `[data-slot="pricing-content"]`
// marker in the DOM means the background isn't the full /pricing page (tool
// paywall or a direct load), so CheckoutFlow refreshes the router itself
// once the purchase succeeds, exactly like the server refresh() it replaces.
describe("CheckoutFlow — router refresh outside the pricing page (A2)", () => {
  it("refreshes once after a successful purchase in the modal variant, and Resume replaces without going back", async () => {
    purchase.mockResolvedValue({ ok: true, balance: 50 });
    renderFlow("modal", 0);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("+50 crédits");
    expect(refresh).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma génération →" }));
    expect(replace).toHaveBeenCalledWith("/bio-insta/tool");
    expect(back).not.toHaveBeenCalled();
  });

  it("refreshes once after a successful purchase in the page variant", async () => {
    purchase.mockResolvedValue({ ok: true, balance: 50 });
    renderFlow("page", 0);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("+50 crédits");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not refresh when the purchase fails", async () => {
    purchase.mockResolvedValue({ ok: false, error: "failed" });
    renderFlow("page");

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("Le paiement a échoué, réessayez");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("CheckoutFlow — errors", () => {
  it("shows the mapped message, re-enables the button, and reuses the same key on retry", async () => {
    purchase.mockResolvedValueOnce({ ok: false, error: "failed" });
    renderFlow("page");

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("Le paiement a échoué, réessayez");

    const button = screen.getByRole("button", { name: "Payer 14,90 € (simulé)" });
    expect(button.hasAttribute("disabled")).toBe(false);

    purchase.mockResolvedValueOnce({ ok: true, balance: 50 });
    fireEvent.click(button);
    await screen.findByText("+50 crédits");

    const [firstKey] = purchase.mock.calls[0] as [string, string, string];
    const [secondKey] = purchase.mock.calls[1] as [string, string, string];
    expect(secondKey).toBe(firstKey);
  });

  it("shows a sign-in link for an unauthenticated purchase", async () => {
    purchase.mockResolvedValue({ ok: false, error: "unauthenticated" });
    renderFlow("page");

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("Connectez-vous pour acheter des crédits");
    expect(screen.getByRole("link", { name: "Se connecter" }).getAttribute("href")).toBe("/bio-insta/signup");
  });

  it("rolls back the optimistic balance overlay after an error", async () => {
    purchase.mockResolvedValue({ ok: false, error: "failed" });
    renderFlow("page", 3);

    fireEvent.click(screen.getByRole("button", { name: "Payer 14,90 € (simulé)" }));
    await screen.findByText("Le paiement a échoué, réessayez");
    await waitFor(() => expect(screen.getByText("3 crédits")).toBeTruthy());
  });
});
