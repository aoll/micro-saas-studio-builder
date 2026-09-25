// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/not-found.json";
import en from "@/messages/en/not-found.json";

afterEach(cleanup);

// testing-library's render() mounts into a <div>, which can't host a real
// <html>/<body> as a child; only the body's own children are DOM-renderable
// here, so the <html> element itself is asserted on directly (type, lang,
// style, className) and only its content is rendered.
function renderBody(html: Awaited<ReturnType<typeof import("./not-found").default>>) {
  const body = html.props.children as { props: { children: Parameters<typeof render>[0] } };
  render(body.props.children);
}

vi.mock("@/app/globals.css", () => ({}));

const appRootParam = vi.fn();
vi.mock("next/root-params", () => ({ app: appRootParam }));

const getProduct = vi.fn();
const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct, listProducts }));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: "fr", messages: { "not-found": fr }, namespace: namespace as never }),
}));

function landingWith(seoTitle: string) {
  return { seoTitle, headline: "h", subheadline: "s", faq: [] };
}

const LETTRE_PRO = {
  slug: "lettre-pro",
  name: "LettrePro",
  status: "scale",
  locale: "fr",
  landing: landingWith("Générateur de lettre de motivation IA"),
};
const NOM_DE_MARQUE = {
  slug: "nom-de-marque",
  name: "NomDeMarque",
  status: "killed",
  locale: "fr",
  landing: landingWith("Générateur de noms de marque"),
};

// R3 (plan round 2): renders the full <html> document for the 404s the
// root layout's notFound() actually lands on — a killed or unknown product
// — since [app]/not-found.tsx never receives them (task 1's spike, outcome
// 3). Reuses the shared ProductNotFound content (product-not-found.tsx).
describe("app/(products)/not-found", () => {
  it("renders <html lang> from the killed product's locale and the shared SA-08 content, without a theme style", async () => {
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue(NOM_DE_MARQUE);
    listProducts.mockResolvedValue([LETTRE_PRO, NOM_DE_MARQUE]);
    const { default: NotFound } = await import("./not-found");
    const ui = await NotFound();
    expect(ui.type).toBe("html");
    expect(ui.props.lang).toBe("fr");
    expect(ui.props.style).toBeUndefined();
    expect(ui.props.className).toBeUndefined();
    renderBody(ui);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ce produit n'est plus disponible" })).toBeTruthy();
    expect(screen.getByText("« NomDeMarque » a fermé ou n'existe pas.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /LettrePro/ })).toBeTruthy();
  });

  it("falls back to lang=fr for an unknown slug (app() resolves to no product)", async () => {
    appRootParam.mockResolvedValue("zz-unknown");
    getProduct.mockResolvedValue(null);
    listProducts.mockResolvedValue([LETTRE_PRO]);
    const { default: NotFound } = await import("./not-found");
    const ui = await NotFound();
    expect(ui.props.lang).toBe("fr");
    renderBody(ui);
    expect(screen.getByText("Ce produit a fermé ou n'existe pas.")).toBeTruthy();
  });

  it("uses the product's English locale", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: string) =>
        createTranslator({ locale: "en", messages: { "not-found": en }, namespace: namespace as never }),
    }));
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue({ ...NOM_DE_MARQUE, locale: "en" });
    listProducts.mockResolvedValue([
      { ...LETTRE_PRO, locale: "en" },
      { ...NOM_DE_MARQUE, locale: "en" },
    ]);
    vi.resetModules();
    const { default: NotFound } = await import("./not-found");
    const ui = await NotFound();
    expect(ui.props.lang).toBe("en");
    renderBody(ui);
    expect(screen.getByRole("heading", { name: "This product is no longer available" })).toBeTruthy();
  });
});
