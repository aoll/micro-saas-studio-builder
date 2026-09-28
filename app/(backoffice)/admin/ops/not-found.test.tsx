// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import OpsNotFound from "./not-found";

afterEach(cleanup);

function renderUi(locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      <OpsNotFound />
    </NextIntlClientProvider>,
  );
}

// QA1-P1-B12: rendered for every non-owner session hitting /admin/ops once
// requireAdmin/the owner check in ops/page.tsx calls notFound() (the proxy's
// own NOT_FOUND_HTML in proxy.ts covers the no-cookie case before this ever
// renders). Same wording as proxy.ts's NOT_FOUND_HTML, no link to /admin: an
// owner-only page stays "cachée" even in its own error state.
describe("app/(backoffice)/admin/ops/not-found", () => {
  it("renders a French 'Page introuvable' heading", () => {
    renderUi();
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy();
  });

  it("never links to /admin", () => {
    renderUi();
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("never mentions ops or owner", () => {
    renderUi();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/ops|owner|propriétaire/);
  });

  // I18N-BACKOFFICE-STRINGS: renders in English.
  it("renders an English 'Page not found' heading", () => {
    renderUi("en");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
  });
});
