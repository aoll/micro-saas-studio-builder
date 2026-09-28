// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-product-form-b1.json";
import fr from "@/messages/fr/backoffice-product-form-b1.json";
import { STEPS, StepNav } from "./step-nav";

afterEach(cleanup);

// I18N-BACKOFFICE-STRINGS (lot 5): StepNav renders its own zone's messages,
// so every test needs the NextIntlClientProvider the real backoffice layout
// provides at runtime (app/(backoffice)/layout.tsx).
function renderUi(ui: React.ReactElement, locale: "fr" | "en" = "fr", messages: Record<string, unknown> = fr) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-product-form-b1": messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("StepNav", () => {
  it("lists every step's title, in French by default", () => {
    renderUi(<StepNav current={1} onSelect={vi.fn()} stepErrors={{}} />);
    for (const step of STEPS) {
      const title = (fr as { stepNav: { steps: Record<string, string> } }).stepNav.steps[step.titleKey]!;
      expect(screen.getByText(new RegExp(title))).toBeTruthy();
    }
  });

  it("lists every step's title in English when rendered with the en locale", () => {
    renderUi(<StepNav current={1} onSelect={vi.fn()} stepErrors={{}} />, "en", en);
    for (const step of STEPS) {
      const title = (en as { stepNav: { steps: Record<string, string> } }).stepNav.steps[step.titleKey]!;
      expect(screen.getByText(new RegExp(title))).toBeTruthy();
    }
  });

  it("marks the current step", () => {
    renderUi(<StepNav current={2} onSelect={vi.fn()} stepErrors={{}} />);
    const current = screen.getByRole("button", { name: /Thème/ });
    expect(current.getAttribute("aria-current")).toBe("step");
  });

  it("switches step on click", () => {
    const onSelect = vi.fn();
    renderUi(<StepNav current={1} onSelect={onSelect} stepErrors={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Landing/ }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("flags a step that has errors", () => {
    renderUi(<StepNav current={1} onSelect={vi.fn()} stepErrors={{ 4: true }} />);
    const flagged = screen.getByRole("button", { name: /Champs/ });
    expect(flagged.getAttribute("data-has-error")).toBe("true");
  });

  it("has an aria-label on the nav, translated", () => {
    renderUi(<StepNav current={1} onSelect={vi.fn()} stepErrors={{}} />);
    expect(screen.getByRole("navigation", { name: fr.stepNav.ariaLabel })).toBeTruthy();
  });
});
