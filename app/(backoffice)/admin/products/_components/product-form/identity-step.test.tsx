// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityStep } from "./identity-step";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof IdentityStep>> = {}) {
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
  const view = render(<IdentityStep {...props} />);
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
});
