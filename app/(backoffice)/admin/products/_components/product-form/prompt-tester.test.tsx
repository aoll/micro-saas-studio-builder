// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptTester } from "./prompt-tester";

afterEach(cleanup);

const fields = [
  { key: "poste", label: "Poste visé", required: true },
  { key: "ton", label: "Ton", required: false },
];

function setup(overrides: Partial<React.ComponentProps<typeof PromptTester>> = {}) {
  const onTest = vi.fn();
  const onTested = vi.fn();
  const props: React.ComponentProps<typeof PromptTester> = { fields, onTest, onTested, ...overrides };
  const view = render(<PromptTester {...props} />);
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
});
