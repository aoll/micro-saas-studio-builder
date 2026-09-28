// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";

const { resetDemoAction, toastSuccess, toastError } = vi.hoisted(() => ({
  resetDemoAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../_actions", () => ({ resetDemoAction }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ResetForm } = await import("./reset-form");

afterEach(() => {
  cleanup();
  resetDemoAction.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

function renderUi(locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      <ResetForm />
    </NextIntlClientProvider>,
  );
}

describe("ResetForm", () => {
  it("shows only the first-step button, no confirmation, by default", () => {
    renderUi();
    expect(screen.getByRole("button", { name: "Réinitialiser la démo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer la réinitialisation" })).toBeNull();
  });

  it("shows the destructive confirm step after the first click, without submitting", () => {
    renderUi();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));

    expect(screen.getByRole("button", { name: "Confirmer la réinitialisation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();
    expect(resetDemoAction).not.toHaveBeenCalled();
  });

  it("cancels back to the first step on Annuler, without submitting", () => {
    renderUi();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByRole("button", { name: "Réinitialiser la démo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer la réinitialisation" })).toBeNull();
    expect(resetDemoAction).not.toHaveBeenCalled();
  });

  it("only calls resetDemoAction (locale bound first) after the second, confirming click", async () => {
    resetDemoAction.mockResolvedValue({ ok: true });
    renderUi();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la réinitialisation" }));

    await vi.waitFor(() => expect(resetDemoAction).toHaveBeenCalledTimes(1));
    expect(resetDemoAction.mock.calls[0]![0]).toBe("fr");
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Démo réinitialisée"));
  });

  it("shows the error as an alert and toasts on failure, staying in the confirm step", async () => {
    resetDemoAction.mockResolvedValue({ error: "La réinitialisation a échoué" });
    renderUi();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la réinitialisation" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("La réinitialisation a échoué");
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  // I18N-BACKOFFICE-STRINGS: static labels render in English, and the
  // bound locale matches.
  it("renders in English and binds the 'en' locale to the action", async () => {
    resetDemoAction.mockResolvedValue({ ok: true });
    renderUi("en");
    expect(screen.getByRole("button", { name: "Reset the demo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset the demo" }));
    expect(screen.getByRole("button", { name: "Confirm the reset" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm the reset" }));
    await vi.waitFor(() => expect(resetDemoAction).toHaveBeenCalledTimes(1));
    expect(resetDemoAction.mock.calls[0]![0]).toBe("en");
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Demo reset"));
  });
});
