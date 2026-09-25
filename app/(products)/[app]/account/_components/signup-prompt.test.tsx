// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";

afterEach(cleanup);

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "account") =>
    createTranslator({ locale: "fr", messages: { account: frAccount }, namespace }),
}));

const openSignupModalSpy = vi.fn();
vi.mock("./open-signup-modal", () => ({
  OpenSignupModal: (props: unknown) => {
    openSignupModalSpy(props);
    return null;
  },
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// SA-07 (spec: "Non connecté → modale d'inscription"): the visible,
// no-JS-required fallback (EmptyState + link to /signup, SA-03), plus the
// auto-open leaf.
describe("SignupPrompt", () => {
  it("renders the empty state, a link to /{slug}/signup and OpenSignupModal with the same href", async () => {
    const { SignupPrompt } = await import("./signup-prompt");
    const ui = await SignupPrompt({ slug: "nom-de-marque" });
    renderUi(ui);

    expect(screen.getByText("Créez un compte pour voir vos crédits")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Créer un compte" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/nom-de-marque/signup");
    expect(openSignupModalSpy).toHaveBeenCalledWith({ href: "/nom-de-marque/signup" });
  });
});
