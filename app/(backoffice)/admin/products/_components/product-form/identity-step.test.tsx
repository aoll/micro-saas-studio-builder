// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-product-form-a.json";
import fr from "@/messages/fr/backoffice-product-form-a.json";
import { IdentityStep } from "./identity-step";

afterEach(cleanup);

// I18N-BACKOFFICE-STRINGS lot 4: IdentityStep now reads its labels through
// useTranslations("backoffice-product-form-a"), so every render needs the
// zone's messages in context — same pattern as locale-switcher.test.tsx.
function setup(overrides: Partial<React.ComponentProps<typeof IdentityStep>> = {}, uiLocale: "fr" | "en" = "fr") {
  const onChange = vi.fn();
  const props: React.ComponentProps<typeof IdentityStep> = {
    mode: "create",
    name: "",
    slug: "",
    status: "test",
    locale: "fr",
    slugEdited: false,
    errors: {},
    onChange,
    ...overrides,
  };
  const messages = uiLocale === "fr" ? fr : en;
  const view = render(
    <NextIntlClientProvider locale={uiLocale} messages={{ "backoffice-product-form-a": messages }}>
      <IdentityStep {...props} />
    </NextIntlClientProvider>,
  );
  return { onChange, ...view };
}

describe("IdentityStep", () => {
  it("derives the slug from the name until the slug is edited by hand", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Générateur de bio Instagram" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Générateur de bio Instagram", slug: "generateur-de-bio-instagram" }),
    );
  });

  it("marks the slug as edited once the slug field is edited directly", () => {
    const { onChange } = setup({ name: "Nom initial", slug: "nom-initial" });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "mon-propre-slug" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ slug: "mon-propre-slug", slugEdited: true }));
  });

  it("no longer derives the slug once slugEdited is true", () => {
    const { onChange } = setup({ name: "Nom initial", slug: "mon-propre-slug", slugEdited: true });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Nom modifié" } });
    expect(onChange).toHaveBeenLastCalledWith({ name: "Nom modifié" });
  });

  it("offers test, learn and scale as the initial status", () => {
    setup();
    const select = screen.getByLabelText("Statut") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["test", "learn", "scale"]);
  });

  it("disables the slug and status fields in edit mode", () => {
    setup({ mode: "edit", slug: "lettre-pro" });
    expect((screen.getByLabelText("Slug") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Statut") as HTMLSelectElement).disabled).toBe(true);
  });

  it("shows the slug error with aria-invalid", () => {
    setup({ errors: { slug: "Ce slug est réservé" } });
    const slugInput = screen.getByLabelText("Slug");
    expect(slugInput.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Ce slug est réservé")).toBeTruthy();
  });

  // I18N-BACKOFFICE-STRINGS: catches a label left hardcoded in French once
  // the admin_locale cookie is "en" (spec acceptance: no French text leaks).
  it("renders every label in English when the locale is en", () => {
    setup({}, "en");
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Slug")).toBeTruthy();
    expect(screen.getByLabelText("Status")).toBeTruthy();
    expect(screen.getByLabelText("Language")).toBeTruthy();
  });
});
