// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/backoffice-product-form-b2.json";
import en from "@/messages/en/backoffice-product-form-b2.json";
import { PromptTester } from "./prompt-tester";

afterEach(cleanup);

const fields = [
  { id: "input-poste", key: "poste", label: "Poste visé", required: true },
  { id: "input-ton", key: "ton", label: "Ton", required: false },
];

// I18N-BACKOFFICE-STRINGS (lot 6): PromptTester now reads its own zone via
// `useTranslations`, so it needs a real NextIntlClientProvider ancestor
// (app/(backoffice)/layout.tsx's, in the real app).
function setup(overrides: Partial<React.ComponentProps<typeof PromptTester>> = {}, locale: "fr" | "en" = "fr") {
  const onTest = vi.fn();
  const onTested = vi.fn();
  const props: React.ComponentProps<typeof PromptTester> = { fields, onTest, onTested, ...overrides };
  const view = render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-product-form-b2": locale === "en" ? en : fr }}>
      <PromptTester {...props} />
    </NextIntlClientProvider>,
  );
  return { onTest, onTested, ...view };
}

describe("PromptTester", () => {
  it("renders one sample field per input, labelled", () => {
    setup();
    expect(screen.getByLabelText("Poste visé")).toBeTruthy();
    expect(screen.getByLabelText("Ton")).toBeTruthy();
  });

  it("calls onTest with the typed sample values", async () => {
    const { onTest } = setup();
    onTest.mockResolvedValue({ ok: true, output: "Résultat", inputTokens: 10, outputTokens: 5, costMicros: 100 });
    fireEvent.change(screen.getByLabelText("Poste visé"), { target: { value: "Développeur" } });
    fireEvent.click(screen.getByRole("button", { name: "Tester le prompt" }));
    await waitFor(() => expect(onTest).toHaveBeenCalledWith({ poste: "Développeur", ton: "" }));
  });

  it("disables the button while pending", async () => {
    const { onTest } = setup();
    let resolveTest: (value: { ok: boolean }) => void = () => undefined;
    onTest.mockReturnValue(new Promise((resolve) => (resolveTest = resolve)));
    const button = screen.getByRole("button", { name: "Tester le prompt" }) as HTMLButtonElement;
    fireEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    resolveTest({ ok: true });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("shows the output, tokens and cost on success, and calls onTested", async () => {
    const { onTested } = setup({
      onTest: vi.fn().mockResolvedValue({
        ok: true,
        output: "Voici votre lettre",
        inputTokens: 210,
        outputTokens: 140,
        costMicros: 910,
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Tester le prompt" }));
    await screen.findByText("Voici votre lettre");
    expect(screen.getByText(/210/)).toBeTruthy();
    expect(screen.getByText(/140/)).toBeTruthy();
    await waitFor(() =>
      expect(onTested).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true, inputTokens: 210, outputTokens: 140, costMicros: 910 }),
      ),
    );
  });

  it("shows an alert with the error message on failure", async () => {
    setup({ onTest: vi.fn().mockResolvedValue({ error: "La génération de test a échoué" }) });
    fireEvent.click(screen.getByRole("button", { name: "Tester le prompt" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("La génération de test a échoué");
  });

  // B-N2 (.claude/qa/reports/2026-09-25-full-3.md): same reasoning as
  // generation-step.test.tsx — two step-4 fields can transiently share the
  // same `key` while the admin is editing it; `key={field.key}` produced
  // React's "two children with the same key" console.error here too.
  it("does not warn React about duplicate keys when two fields share the same key", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    setup({
      fields: [
        { id: "input-a", key: "niche", label: "Niche A", required: false },
        { id: "input-b", key: "niche", label: "Niche B", required: false },
      ],
    });
    const duplicateKeyWarning = consoleError.mock.calls.some((call) => String(call[0]).includes("same key"));
    consoleError.mockRestore();
    expect(duplicateKeyWarning).toBe(false);
  });

  // I18N-BACKOFFICE-STRINGS (lot 6): an admin with admin_locale=en never
  // sees the French button label or result summary.
  it("renders the button and result summary in English for the en locale", async () => {
    setup(
      {
        onTest: vi
          .fn()
          .mockResolvedValue({ ok: true, output: "Hi", inputTokens: 210, outputTokens: 140, costMicros: 910 }),
      },
      "en",
    );
    expect(screen.getByRole("button", { name: "Test the prompt" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Test the prompt" }));
    await screen.findByText("Hi");
    expect(screen.getByText(/210 in \/ 140 out/)).toBeTruthy();
  });
});
