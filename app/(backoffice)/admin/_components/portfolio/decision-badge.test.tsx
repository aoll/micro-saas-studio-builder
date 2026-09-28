// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { DecisionBadge } from "./decision-badge";

afterEach(cleanup);

describe("DecisionBadge", () => {
  it('renders "à couper" for a kill decision, in a destructive colour, when no labels prop is given', () => {
    render(<DecisionBadge decision="kill" />);
    const badge = screen.getByText("à couper");
    expect(badge.className).toContain("destructive");
  });

  it('renders "à scaler" for a scale decision, when no labels prop is given', () => {
    render(<DecisionBadge decision="scale" />);
    expect(screen.getByText("à scaler")).toBeTruthy();
  });

  it("renders nothing for no decision", () => {
    const { container } = render(<DecisionBadge decision={null} />);
    expect(container.textContent).toBe("");
  });

  // I18N-BACKOFFICE-STRINGS: PortfolioTable passes translated labels
  // explicitly (component stays i18n-context-free — also used directly by
  // sheet-header.tsx, outside this lot's Périmètre, without a
  // NextIntlClientProvider for backoffice-portfolio).
  it("renders the given labels instead of the French defaults", () => {
    render(<DecisionBadge decision="kill" labels={{ cut: "cut", scale: "scale" }} />);
    expect(screen.getByText("cut")).toBeTruthy();
    cleanup();
    render(<DecisionBadge decision="scale" labels={{ cut: "cut", scale: "scale" }} />);
    expect(screen.getByText("scale")).toBeTruthy();
  });
});
