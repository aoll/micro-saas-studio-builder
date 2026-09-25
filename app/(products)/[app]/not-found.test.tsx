// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/not-found.json";
import en from "@/messages/en/not-found.json";

afterEach(cleanup);

const appRootParam = vi.fn();
vi.mock("next/root-params", () => ({ app: appRootParam }));

const getProduct = vi.fn();
const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct, listProducts }));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const locale = "fr";
    return createTranslator({ locale, messages: { "not-found": fr }, namespace: namespace as never });
  },
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
const DESCRI_PRO = {
  slug: "descri-pro",
  name: "DescriPro",
  status: "learn",
  locale: "fr",
  landing: landingWith("Générateur de description produit IA"),
};
const NOM_DE_MARQUE = {
  slug: "nom-de-marque",
  name: "NomDeMarque",
  status: "killed",
  locale: "fr",
  landing: landingWith("Générateur de noms de marque"),
};

describe("[app]/not-found", () => {
  it("shows the closed message with the product's name for a killed product", async () => {
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue(NOM_DE_MARQUE);
    listProducts.mockResolvedValue([LETTRE_PRO, NOM_DE_MARQUE]);
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ce produit n'est plus disponible" })).toBeTruthy();
    expect(screen.getByText("« NomDeMarque » a fermé ou n'existe pas.")).toBeTruthy();
  });

  it("shows the generic message for an unknown slug, never echoing the requested slug", async () => {
    appRootParam.mockResolvedValue("zz-unknown-slug");
    getProduct.mockResolvedValue(null);
    listProducts.mockResolvedValue([LETTRE_PRO]);
    const { default: NotFound } = await import("./not-found");
    const { container } = render(await NotFound());
    expect(screen.getByText("Ce produit a fermé ou n'existe pas.")).toBeTruthy();
    expect(container.textContent).not.toContain("zz-unknown-slug");
  });

  it("shows the generic message when app() has no value, without calling getProduct", async () => {
    appRootParam.mockResolvedValue(undefined);
    listProducts.mockResolvedValue([LETTRE_PRO]);
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.getByText("Ce produit a fermé ou n'existe pas.")).toBeTruthy();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it("lists active products in name order, excluding killed ones", async () => {
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue(NOM_DE_MARQUE);
    listProducts.mockResolvedValue([LETTRE_PRO, DESCRI_PRO, NOM_DE_MARQUE]);
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual(["/descri-pro", "/lettre-pro"]);
    expect(screen.getByText("Générateur de lettre de motivation IA")).toBeTruthy();
    expect(screen.queryByText("NomDeMarque")).toBeNull();
  });

  it("hides the other-tools section when there is no active product", async () => {
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue(NOM_DE_MARQUE);
    listProducts.mockResolvedValue([NOM_DE_MARQUE]);
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.queryByText("Nos autres outils")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows the nested page-missing state for an active product, excluding it from the list", async () => {
    appRootParam.mockResolvedValue("lettre-pro");
    getProduct.mockResolvedValue(LETTRE_PRO);
    listProducts.mockResolvedValue([LETTRE_PRO, DESCRI_PRO]);
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy();
    expect(screen.getByText("Cette page n'existe pas sur LettrePro.")).toBeTruthy();
    const backLink = screen.getByRole("link", { name: "Retour à LettrePro" }) as HTMLAnchorElement;
    expect(backLink.getAttribute("href")).toBe("/lettre-pro");
    const otherLinks = screen.getAllByRole("link").filter((link) => link !== backLink);
    expect(otherLinks.map((link) => link.getAttribute("href"))).toEqual(["/descri-pro"]);
  });

  it("renders English text for an English product", async () => {
    vi.doMock("next-intl/server", () => ({
      getTranslations: async (namespace: string) =>
        createTranslator({ locale: "en", messages: { "not-found": en }, namespace: namespace as never }),
    }));
    appRootParam.mockResolvedValue("nom-de-marque");
    getProduct.mockResolvedValue({ ...NOM_DE_MARQUE, locale: "en" });
    listProducts.mockResolvedValue([{ ...LETTRE_PRO, locale: "en" }, NOM_DE_MARQUE]);
    vi.resetModules();
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.getByRole("heading", { name: "This product is no longer available" })).toBeTruthy();
    expect(screen.getByText("“NomDeMarque” has closed or does not exist.")).toBeTruthy();
    expect(screen.getByText("Our other tools")).toBeTruthy();
  });
});
