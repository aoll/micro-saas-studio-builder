// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-themes.json";
import fr from "@/messages/fr/backoffice-themes.json";
import { UsageWarning } from "./usage-warning";

afterEach(cleanup);

// I18N-BACKOFFICE-STRINGS (lot 7): UsageWarning takes its translator as a
// prop, resolved once by the async ThemeEditorLoader — same reasoning as
// ThemeCard (lot 7's theme-card.tsx comment): stays a synchronous Server
// Component.
const t = createTranslator({ locale: "fr", messages: { "backoffice-themes": fr }, namespace: "backoffice-themes" });
const tEn = createTranslator({ locale: "en", messages: { "backoffice-themes": en }, namespace: "backoffice-themes" });

describe("UsageWarning", () => {
  it("shows 'Aucun produit' with no status role for a theme used by nobody", () => {
    render(<UsageWarning productNames={[]} t={t} />);
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a status-role warning for a theme used by one product", () => {
    render(<UsageWarning productNames={["LettrePro"]} t={t} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Utilisé par 1 produit · LettrePro. Les modifications s'appliquent immédiatement.");
  });

  it("shows a status-role warning for a theme used by several products", () => {
    render(<UsageWarning productNames={["DescriPro", "LettrePro"]} t={t} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(
      "Utilisé par 2 produits · DescriPro, LettrePro. Les modifications s'appliquent immédiatement.",
    );
  });

  it("shows the en warning text for the en locale", () => {
    render(<UsageWarning productNames={["LettrePro"]} t={tEn} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Used by 1 product · LettrePro. Changes apply immediately.");
  });

  it("shows the en 'no product' text with no status role", () => {
    render(<UsageWarning productNames={[]} t={tEn} />);
    expect(screen.getByText("No product")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
