// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import { DecisionBadge } from "./decision-badge";

afterEach(cleanup);

function renderUi(decision: "kill" | "scale" | null, locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      <DecisionBadge decision={decision} />
    </NextIntlClientProvider>,
  );
}

describe("DecisionBadge", () => {
  it('renders "à couper" for a kill decision, in a destructive colour', () => {
    renderUi("kill");
    const badge = screen.getByText("à couper");
    expect(badge.className).toContain("destructive");
  });

  it('renders "à scaler" for a scale decision', () => {
    renderUi("scale");
    expect(screen.getByText("à scaler")).toBeTruthy();
  });

  it("renders nothing for no decision", () => {
    const { container } = renderUi(null);
    expect(container.textContent).toBe("");
  });

  it('renders "cut" and "scale" in English', () => {
    renderUi("kill", "en");
    expect(screen.getByText("cut")).toBeTruthy();
    cleanup();
    renderUi("scale", "en");
    expect(screen.getByText("scale")).toBeTruthy();
  });
});
