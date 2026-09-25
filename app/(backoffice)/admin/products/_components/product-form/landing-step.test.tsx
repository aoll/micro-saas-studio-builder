// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { LandingStep } from "./landing-step";

afterEach(cleanup);

const baseLanding: ProductConfig["landing"] = {
  headline: "",
  subheadline: "",
  faq: [],
  seoTitle: "",
  seoDescription: "",
};

function setup(landing: ProductConfig["landing"] = baseLanding, errors: Record<string, string> = {}) {
  const onChange = vi.fn();
  const view = render(<LandingStep landing={landing} errors={errors} onChange={onChange} />);
  return { onChange, ...view };
}

describe("LandingStep", () => {
  it("edits the headline and subheadline", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Un titre" } });
    expect(onChange).toHaveBeenLastCalledWith({ headline: "Un titre" });
    fireEvent.change(screen.getByLabelText("Sous-titre"), { target: { value: "Un sous-titre" } });
    expect(onChange).toHaveBeenLastCalledWith({ subheadline: "Un sous-titre" });
  });

  it("adds and removes a FAQ entry", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une question" }));
    expect(onChange).toHaveBeenLastCalledWith({ faq: [{ question: "", answer: "" }] });

    const withFaq = { ...baseLanding, faq: [{ question: "Q", answer: "A" }] };
    const { onChange: onChange2 } = setup(withFaq);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette question" }));
    expect(onChange2).toHaveBeenLastCalledWith({ faq: [] });
  });

  it("shows the SEO title counter and turns it red past 60 characters", () => {
    setup({ ...baseLanding, seoTitle: "x".repeat(61) });
    const counter = screen.getByText("61 / 60");
    expect(counter.getAttribute("aria-live")).toBe("polite");
    expect(counter.className).toContain("text-destructive");
  });

  it("keeps the SEO description counter neutral under the 160-character limit", () => {
    setup({ ...baseLanding, seoDescription: "x".repeat(50) });
    const counter = screen.getByText("50 / 160");
    expect(counter.className).not.toContain("text-destructive");
  });

  it("shows a FAQ answer error at its path", () => {
    setup({ ...baseLanding, faq: [{ question: "Q", answer: "" }] }, { "landing.faq.0.answer": "Ce champ est requis" });
    expect(screen.getByText("Ce champ est requis")).toBeTruthy();
  });

  it("edits the example output", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Exemple de résultat"), { target: { value: "✨ Une bio" } });
    expect(onChange).toHaveBeenLastCalledWith({ exampleOutput: "✨ Une bio" });
  });

  it("adds a 'how it works' step with empty title and description", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une étape" }));
    expect(onChange).toHaveBeenLastCalledWith({ steps: [{ title: "", description: "" }] });
  });

  it("edits a 'how it works' step's title and description", () => {
    const withSteps = { ...baseLanding, steps: [{ title: "Titre", description: "Description" }] };
    const { onChange } = setup(withSteps);
    fireEvent.change(screen.getByLabelText("Titre de l'étape 1"), { target: { value: "Nouveau titre" } });
    expect(onChange).toHaveBeenLastCalledWith({ steps: [{ title: "Nouveau titre", description: "Description" }] });
    fireEvent.change(screen.getByLabelText("Description de l'étape 1"), { target: { value: "Nouvelle description" } });
    expect(onChange).toHaveBeenLastCalledWith({ steps: [{ title: "Titre", description: "Nouvelle description" }] });
  });

  it("removes a 'how it works' step", () => {
    const withSteps = {
      ...baseLanding,
      steps: [
        { title: "Étape 1", description: "Description 1" },
        { title: "Étape 2", description: "Description 2" },
      ],
    };
    const { onChange } = setup(withSteps);
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer cette étape" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ steps: [{ title: "Étape 2", description: "Description 2" }] });
  });

  it("reorders 'how it works' steps with Monter and Descendre", () => {
    const withSteps = {
      ...baseLanding,
      steps: [
        { title: "Étape 1", description: "Description 1" },
        { title: "Étape 2", description: "Description 2" },
      ],
    };
    const { onChange } = setup(withSteps);
    fireEvent.click(screen.getAllByRole("button", { name: "Descendre" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({
      steps: [
        { title: "Étape 2", description: "Description 2" },
        { title: "Étape 1", description: "Description 1" },
      ],
    });
  });

  it("shows the preview when the steps list is rendered even if empty", () => {
    setup();
    expect(screen.getByRole("button", { name: "Ajouter une étape" })).toBeTruthy();
  });
});
