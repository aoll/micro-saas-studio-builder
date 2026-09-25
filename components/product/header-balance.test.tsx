// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession }));

const getBalance = vi.fn();
vi.mock("@/lib/dal/credits", () => ({ getBalance }));

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("HeaderBalance", () => {
  it("renders a sign-in link when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { HeaderBalance } = await import("./header-balance");
    const ui = await HeaderBalance({ productId: "product-1", slug: "lettre-pro" });
    renderUi(ui);
    const link = screen.getByRole("link", { name: "Connexion" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/signup");
    expect(getBalance).not.toHaveBeenCalled();
  });

  it("renders the balance badge for a signed-in user", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    getBalance.mockResolvedValue(5);
    const { HeaderBalance } = await import("./header-balance");
    const ui = await HeaderBalance({ productId: "product-1", slug: "lettre-pro" });
    renderUi(ui);
    expect(getBalance).toHaveBeenCalledWith("user-1", "product-1");
    expect(screen.getByText("5 crédits")).toBeTruthy();
  });

  it("links the balance badge to the account page (SA-07)", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    getBalance.mockResolvedValue(5);
    const { HeaderBalance } = await import("./header-balance");
    const ui = await HeaderBalance({ productId: "product-1", slug: "lettre-pro" });
    renderUi(ui);
    const link = screen.getByRole("link", { name: "5 crédits" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/lettre-pro/account");
  });
});
