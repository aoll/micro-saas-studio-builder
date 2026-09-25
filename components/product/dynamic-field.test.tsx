// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { DynamicField } from "./dynamic-field";

afterEach(cleanup);

type Field = ProductConfig["inputs"][number];

const textField: Field = { key: "poste", label: "Poste visé", type: "text", required: true, maxLength: 80 };
const textareaField: Field = { key: "experience", label: "Expérience", type: "textarea", required: false };
const selectField: Field = {
  key: "ton",
  label: "Ton",
  type: "select",
  required: true,
  options: ["formel", "dynamique"],
};

describe("DynamicField", () => {
  it("renders a text field as a required input with a maxLength", () => {
    render(<DynamicField field={textField} />);
    const input = screen.getByLabelText("Poste visé") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.name).toBe("poste");
    expect(input.required).toBe(true);
    expect(input.maxLength).toBe(80);
  });

  it("renders a textarea field", () => {
    render(<DynamicField field={textareaField} />);
    const textarea = screen.getByLabelText("Expérience");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).required).toBe(false);
  });

  it("renders a select field with its options", () => {
    render(<DynamicField field={selectField} />);
    const select = screen.getByLabelText("Ton") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["formel", "dynamique"]);
  });

  it("marks a field with an error as invalid and describes it", () => {
    render(<DynamicField field={textField} error="Champ requis" />);
    const input = screen.getByLabelText("Poste visé");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Champ requis");
  });

  it("has no aria-invalid when there is no error", () => {
    render(<DynamicField field={textField} />);
    const input = screen.getByLabelText("Poste visé");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("carries the default value", () => {
    render(<DynamicField field={textField} defaultValue="Développeur" />);
    const input = screen.getByLabelText("Poste visé") as HTMLInputElement;
    expect(input.value).toBe("Développeur");
  });
});
