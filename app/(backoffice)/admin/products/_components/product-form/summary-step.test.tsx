// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/backoffice-product-form-b2.json";
import en from "@/messages/en/backoffice-product-form-b2.json";
import { SummaryStep } from "./summary-step";

afterEach(cleanup);

const draft = { name: "BioInsta", slug: "bio-instagram", inputsCount: 2, packsCount: 2 };

// I18N-BACKOFFICE-STRINGS (lot 6): SummaryStep now reads its own zone via
// `useTranslations`, so it needs a real NextIntlClientProvider ancestor
// (app/(backoffice)/layout.tsx's, in the real app) — `locale` lets the new
// English-locale tests below reuse the same setup.
function setup(overrides: Partial<React.ComponentProps<typeof SummaryStep>> = {}, locale: "fr" | "en" = "fr") {
  const formAction = vi.fn();
  const props: React.ComponentProps<typeof SummaryStep> = {
    draft,
    themeName: "Neon",
    pending: false,
    state: {},
    formAction,
    ...overrides,
  };
  // The Publier button's `formAction` attribute only takes effect inside a
  // real <form>, matching how ProductForm renders SummaryStep.
  const view = render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-product-form-b2": locale === "en" ? en : fr }}>
      <form>
        <SummaryStep {...props} />
      </form>
    </NextIntlClientProvider>,
  );
  return { formAction, ...view };
}

describe("SummaryStep", () => {
  it("recaps the draft: name, slug, theme, field and pack counts", () => {
    setup();
    expect(screen.getByText("BioInsta")).toBeTruthy();
    expect(screen.getByText("bio-instagram")).toBeTruthy();
    expect(screen.getByText("Neon")).toBeTruthy();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("disables Publier while pending", () => {
    setup({ pending: true });
    expect((screen.getByRole("button", { name: "Publier" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the form-level error as an alert", () => {
    setup({ state: { formError: "Produit introuvable" } });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Produit introuvable");
  });

  it("shows a link to the published product on success", () => {
    setup({ state: { ok: true, slug: "bio-instagram", version: 1, url: "/bio-instagram" } });
    const link = screen.getByRole("link", { name: /bio-instagram/ });
    expect(link.getAttribute("href")).toBe("/bio-instagram");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("submits through the injected formAction when Publier is clicked", () => {
    const { formAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(formAction).toHaveBeenCalled();
  });

  // I18N-BACKOFFICE-STRINGS (lot 6): an admin with admin_locale=en never
  // sees the French labels or button text.
  it("renders in English for the en locale", () => {
    setup({ state: { ok: true, slug: "bio-instagram", version: 1, url: "/bio-instagram" } }, "en");
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByText("Tool fields")).toBeTruthy();
    expect(screen.getByText("Credit packs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.getByText(/Product published/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View /bio-instagram" })).toBeTruthy();
    expect(screen.queryByText("Publier")).toBeNull();
  });
});
