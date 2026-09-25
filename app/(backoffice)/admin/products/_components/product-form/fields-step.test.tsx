// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldsStep } from "./fields-step";
import type { FieldDraft } from "./form-values";

afterEach(cleanup);

function field(overrides: Partial<FieldDraft> = {}): FieldDraft {
  return { id: crypto.randomUUID(), key: "champ_1", label: "Champ 1", type: "text", required: true, ...overrides };
}

function setup(fields: FieldDraft[], errors: Record<string, string> = {}) {
  const onChange = vi.fn();
  const view = render(<FieldsStep fields={fields} errors={errors} onChange={onChange} />);
  return { onChange, ...view };
}

describe("FieldsStep", () => {
  it("adds a new text field, not required, with the next default key", () => {
    const fields = [field()];
    const { onChange } = setup(fields);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un champ" }));
    const [nextFields] = onChange.mock.calls.at(-1)!;
    expect(nextFields).toHaveLength(2);
    expect(nextFields[1]).toMatchObject({ key: "champ_2", type: "text", required: false });
  });

  it("disables adding a field once 10 exist", () => {
    const fields = Array.from({ length: 10 }, (_, i) => field({ id: `f${i}`, key: `champ_${i + 1}` }));
    setup(fields);
    expect((screen.getByRole("button", { name: "Ajouter un champ" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables removing a field when only one remains", () => {
    setup([field()]);
    expect((screen.getByRole("button", { name: "Supprimer ce champ" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves a field down and disables the edge buttons", () => {
    const fields = [field({ id: "a", key: "champ_1" }), field({ id: "b", key: "champ_2" })];
    const { onChange } = setup(fields);
    const upButtons = screen.getAllByRole("button", { name: "Monter" }) as HTMLButtonElement[];
    const downButtons = screen.getAllByRole("button", { name: "Descendre" }) as HTMLButtonElement[];
    expect(upButtons[0]!.disabled).toBe(true);
    expect(downButtons[1]!.disabled).toBe(true);

    fireEvent.click(downButtons[0]!);
    const [nextFields] = onChange.mock.calls.at(-1)!;
    expect(nextFields.map((f: FieldDraft) => f.key)).toEqual(["champ_2", "champ_1"]);
  });

  it("shows options only for a select field", () => {
    const { rerender } = render(<FieldsStep fields={[field({ type: "text" })]} errors={{}} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Options (une par ligne)")).toBeNull();
    rerender(<FieldsStep fields={[field({ type: "select", options: ["a", "b"] })]} errors={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Options (une par ligne)")).toBeTruthy();
  });

  it("shows a key error at its path", () => {
    setup([field({ id: "a", key: "sujet" }), field({ id: "b", key: "sujet" })], {
      "inputs.1.key": "Clé déjà utilisée",
    });
    expect(screen.getByText("Clé déjà utilisée")).toBeTruthy();
  });
});
