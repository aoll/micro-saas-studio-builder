// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAuth from "@/messages/fr/auth.json";
import type { Product } from "@/lib/dal/products";

afterEach(cleanup);

const app = vi.fn();
vi.mock("next/root-params", () => ({ app: () => app() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const back = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ back }),
}));

// next-intl/server picks its "react-server" export via a condition Vitest's
// node/jsdom environments don't set (see @modal/(.)pricing/page.test.tsx).
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "auth") =>
    createTranslator({ locale: "fr", messages: { auth: frAuth }, namespace }),
}));

const { requestMagicLink } = vi.hoisted(() => ({ requestMagicLink: vi.fn() }));
vi.mock("@/app/(products)/[app]/signup/_actions", () => ({
  requestMagicLink,
  initialSignupState: { status: "idle" },
}));

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, auth: frAuth }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const product: Product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "lettre-pro",
  name: "LettrePro",
  status: "test",
  themeId: "theme-1",
  locale: "fr",
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "poste", label: "Poste", type: "text", required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
  },
};

describe("@modal/(.)signup page", () => {
  it("renders the signup form in an open dialog titled with the free-credits count, exactly once", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { default: SignupModal } = await import("./page");
    const ui = await SignupModal();
    renderUi(ui);

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Vous avez aimé ?");
    expect(dialog.textContent).toContain("3 crédits offerts");
    // RouteModal's DialogTitle is the only heading: SignupFlow renders none
    // of its own, so the heading never appears twice inside the modal.
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("navigates back when closed", async () => {
    app.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(product);
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { default: SignupModal } = await import("./page");
    const ui = await SignupModal();
    renderUi(ui);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });

  it("calls notFound for an unknown product", async () => {
    app.mockResolvedValue("unknown-slug");
    getProduct.mockResolvedValue(null);
    const { default: SignupModal } = await import("./page");
    await expect(SignupModal()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
