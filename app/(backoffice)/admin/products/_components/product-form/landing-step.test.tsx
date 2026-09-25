// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LandingDraft } from "./form-values";
import { LandingStep } from "./landing-step";

afterEach(cleanup);

const baseLanding: LandingDraft = {
  headline: "",
  subheadline: "",
  faq: [],
  seoTitle: "",
  seoDescription: "",
};

function setup(landing: LandingDraft = baseLanding, errors: Record<string, string> = {}) {
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

  // Review QA1-P1-M1 (MEDIUM #1): a reordered step needs a stable React key
  // of its own, distinct from its array position — added a step now carries
  // a fresh client-only `id`, mirroring FieldsStep's `id`-keyed rows.
  it("adds a 'how it works' step with empty title and description, and a stable client id", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une étape" }));
    const call = onChange.mock.calls[0]![0] as { steps: { id: string; title: string; description: string }[] };
    expect(call.steps).toHaveLength(1);
    expect(call.steps[0]?.id).toBeTruthy();
    expect(call.steps[0]).toMatchObject({ title: "", description: "" });
  });

  it("edits a 'how it works' step's title and description", () => {
    const withSteps = { ...baseLanding, steps: [{ id: "step-1", title: "Titre", description: "Description" }] };
    const { onChange } = setup(withSteps);
    fireEvent.change(screen.getByLabelText("Titre de l'étape 1"), { target: { value: "Nouveau titre" } });
    expect(onChange).toHaveBeenLastCalledWith({
      steps: [{ id: "step-1", title: "Nouveau titre", description: "Description" }],
    });
    fireEvent.change(screen.getByLabelText("Description de l'étape 1"), { target: { value: "Nouvelle description" } });
    expect(onChange).toHaveBeenLastCalledWith({
      steps: [{ id: "step-1", title: "Titre", description: "Nouvelle description" }],
    });
  });

  it("removes a 'how it works' step", () => {
    const withSteps = {
      ...baseLanding,
      steps: [
        { id: "step-1", title: "Étape 1", description: "Description 1" },
        { id: "step-2", title: "Étape 2", description: "Description 2" },
      ],
    };
    const { onChange } = setup(withSteps);
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer cette étape" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({
      steps: [{ id: "step-2", title: "Étape 2", description: "Description 2" }],
    });
  });

  it("reorders 'how it works' steps with Monter and Descendre", () => {
    const withSteps = {
      ...baseLanding,
      steps: [
        { id: "step-1", title: "Étape 1", description: "Description 1" },
        { id: "step-2", title: "Étape 2", description: "Description 2" },
      ],
    };
    const { onChange } = setup(withSteps);
    fireEvent.click(screen.getAllByRole("button", { name: "Descendre" })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({
      steps: [
        { id: "step-2", title: "Étape 2", description: "Description 2" },
        { id: "step-1", title: "Étape 1", description: "Description 1" },
      ],
    });
  });

  it("shows the preview when the steps list is rendered even if empty", () => {
    setup();
    expect(screen.getByRole("button", { name: "Ajouter une étape" })).toBeTruthy();
  });

  // Review QA1-P1-M1 (MEDIUM #2): title/description had no error wiring.
  it("shows a 'how it works' step title error at its path, with aria-invalid and aria-describedby", () => {
    const withSteps = { ...baseLanding, steps: [{ id: "step-1", title: "", description: "Description" }] };
    setup(withSteps, { "landing.steps.0.title": "Ce champ est requis" });
    const field = screen.getByLabelText("Titre de l'étape 1");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const errorId = field.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    const error = screen.getByText("Ce champ est requis");
    expect(error.id).toBe(errorId);
  });

  it("shows a 'how it works' step description error at its path, with aria-invalid and aria-describedby", () => {
    const withSteps = { ...baseLanding, steps: [{ id: "step-1", title: "Titre", description: "" }] };
    setup(withSteps, { "landing.steps.0.description": "Ce champ est requis" });
    const field = screen.getByLabelText("Description de l'étape 1");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const errorId = field.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    const error = screen.getByText("Ce champ est requis");
    expect(error.id).toBe(errorId);
  });
});
