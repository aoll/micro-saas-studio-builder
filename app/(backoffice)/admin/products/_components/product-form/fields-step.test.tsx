// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-product-form-a.json";
import fr from "@/messages/fr/backoffice-product-form-a.json";
import { FieldsStep } from "./fields-step";
import type { FieldDraft } from "./form-values";

afterEach(cleanup);

function field(overrides: Partial<FieldDraft> = {}): FieldDraft {
  return { id: crypto.randomUUID(), key: "champ_1", label: "Champ 1", type: "text", required: true, ...overrides };
}

// I18N-BACKOFFICE-STRINGS lot 4: FieldsStep now reads its labels through
// useTranslations("backoffice-product-form-a"), so every render needs the
// zone's messages in context.
function setup(fields: FieldDraft[], errors: Record<string, string> = {}, uiLocale: "fr" | "en" = "fr") {
  const onChange = vi.fn();
  const messages = uiLocale === "fr" ? fr : en;
  const view = render(
    <NextIntlClientProvider locale={uiLocale} messages={{ "backoffice-product-form-a": messages }}>
      <FieldsStep fields={fields} errors={errors} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return { onChange, ...view };
}

function renderRaw(ui: React.ReactElement, uiLocale: "fr" | "en" = "fr") {
  const messages = uiLocale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={uiLocale} messages={{ "backoffice-product-form-a": messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
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
    const { rerender } = renderRaw(<FieldsStep fields={[field({ type: "text" })]} errors={{}} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Options (une par ligne)")).toBeNull();
    rerender(
      <NextIntlClientProvider locale="fr" messages={{ "backoffice-product-form-a": fr }}>
        <FieldsStep fields={[field({ type: "select", options: ["a", "b"] })]} errors={{}} onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText("Options (une par ligne)")).toBeTruthy();
  });

  it("shows a key error at its path", () => {
    setup([field({ id: "a", key: "sujet" }), field({ id: "b", key: "sujet" })], {
      "inputs.1.key": "Clé déjà utilisée",
    });
    expect(screen.getByText("Clé déjà utilisée")).toBeTruthy();
  });

  // I18N-BACKOFFICE-STRINGS: catches a label left hardcoded in French once
  // the admin_locale cookie is "en" (spec acceptance: no French text leaks).
  it("renders every label, field type and button in English when the locale is en", () => {
    setup([field({ type: "select", options: ["a", "b"] })], {}, "en");
    expect(screen.getByLabelText("Key")).toBeTruthy();
    expect(screen.getByLabelText("Label")).toBeTruthy();
    expect(screen.getByLabelText("Type")).toBeTruthy();
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByLabelText("Options (one per line)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a field" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove this field" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move down" })).toBeTruthy();

    const select = screen.getByLabelText("Type") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Text", "Text area", "List"]);
  });
});
