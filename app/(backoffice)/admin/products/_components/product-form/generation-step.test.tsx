// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { GenerationStep } from "./generation-step";

afterEach(cleanup);

const inputs: { key: string }[] = [{ key: "poste" }, { key: "entreprise" }];

const generation: ProductConfig["generation"] = {
  model: "anthropic/claude-haiku-4.5",
  promptTemplate: "Rédige une lettre pour {{poste}}",
  outputType: "markdown",
};

function setup(overrides: Partial<React.ComponentProps<typeof GenerationStep>> = {}) {
  const onChange = vi.fn();
  const props: React.ComponentProps<typeof GenerationStep> = {
    generation,
    inputs,
    errors: {},
    onChange,
    ...overrides,
  };
  const view = render(<GenerationStep {...props} />);
  return { onChange, ...view };
}

describe("GenerationStep", () => {
  it("shows the current model as selected, and lists Haiku and Sonnet", () => {
    setup();
    const select = screen.getByLabelText("Modèle") as HTMLSelectElement;
    expect(select.value).toBe("anthropic/claude-haiku-4.5");
    expect(screen.getByText(/Haiku/)).toBeTruthy();
    expect(screen.getByText(/Sonnet/)).toBeTruthy();
  });

  it("includes the stored model in the list when it's neither Haiku nor Sonnet", () => {
    setup({ generation: { ...generation, model: "openai/gpt-5-mini" } });
    const select = screen.getByLabelText("Modèle") as HTMLSelectElement;
    expect(select.value).toBe("openai/gpt-5-mini");
  });

  it("changes the model", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Modèle"), { target: { value: "anthropic/claude-sonnet-5" } });
    expect(onChange).toHaveBeenCalledWith({ model: "anthropic/claude-sonnet-5" });
  });

  it("edits the prompt template", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Template de prompt"), { target: { value: "Nouveau texte" } });
    expect(onChange).toHaveBeenCalledWith({ promptTemplate: "Nouveau texte" });
  });

  it("inserts a {{variable}} chip at the caret", () => {
    const { onChange } = setup();
    const textarea = screen.getByLabelText("Template de prompt") as HTMLTextAreaElement;
    textarea.setSelectionRange(8, 8); // right after "Rédige "... actually caret irrelevant here
    Object.defineProperty(textarea, "selectionStart", { value: 0, configurable: true });
    Object.defineProperty(textarea, "selectionEnd", { value: 0, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "{{entreprise}}" }));
    expect(onChange).toHaveBeenCalledWith({ promptTemplate: `{{entreprise}}${generation.promptTemplate}` });
  });

  it("shows a live error for a {{variable}} without a matching field, even before saving", () => {
    setup({ generation: { ...generation, promptTemplate: "Pour {{inconnu}}" } });
    const field = screen.getByText(/sans champ correspondant/);
    expect(field).toBeTruthy();
    expect(screen.getByLabelText("Template de prompt").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows no live error when every variable matches a field", () => {
    setup();
    expect(screen.queryByText(/sans champ correspondant/)).toBeNull();
    expect(screen.getByLabelText("Template de prompt").getAttribute("aria-invalid")).toBeNull();
  });

  it("selects markdown output by default, and disables image", () => {
    setup();
    const group = screen.getByRole("radiogroup", { name: "Type de sortie" });
    const markdown = screen.getByRole("radio", { name: /Markdown/ });
    const image = screen.getByRole("radio", { name: /Image/ });
    expect(group).toBeTruthy();
    expect(markdown.getAttribute("aria-checked")).toBe("true");
    expect(image.hasAttribute("disabled")).toBe(true);
  });

  it("shows the server-side error message when given one", () => {
    setup({ errors: { "generation.promptTemplate": "Ce champ est requis" } });
    expect(screen.getByText("Ce champ est requis")).toBeTruthy();
  });
});
