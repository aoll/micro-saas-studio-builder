// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryStep } from "./summary-step";

afterEach(cleanup);

const draft = { name: "BioInsta", slug: "bio-instagram", inputsCount: 2, packsCount: 2 };

function setup(overrides: Partial<React.ComponentProps<typeof SummaryStep>> = {}) {
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
    <form>
      <SummaryStep {...props} />
    </form>,
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
  });

  it("submits through the injected formAction when Publier is clicked", () => {
    const { formAction } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    expect(formAction).toHaveBeenCalled();
  });
});
