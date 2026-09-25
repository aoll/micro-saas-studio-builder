// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("ResetForm", () => {
  it("shows only the first-step button, no confirmation, by default", () => {
    render(<ResetForm />);
    expect(screen.getByRole("button", { name: "Réinitialiser la démo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer la réinitialisation" })).toBeNull();
  });

  it("shows the destructive confirm step after the first click, without submitting", () => {
    render(<ResetForm />);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));

    expect(screen.getByRole("button", { name: "Confirmer la réinitialisation" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeTruthy();
    expect(resetDemoAction).not.toHaveBeenCalled();
  });

  it("cancels back to the first step on Annuler, without submitting", () => {
    render(<ResetForm />);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByRole("button", { name: "Réinitialiser la démo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmer la réinitialisation" })).toBeNull();
    expect(resetDemoAction).not.toHaveBeenCalled();
  });

  it("only calls resetDemoAction after the second, confirming click", async () => {
    resetDemoAction.mockResolvedValue({ ok: true });
    render(<ResetForm />);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la réinitialisation" }));

    await vi.waitFor(() => expect(resetDemoAction).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("shows the error as an alert and toasts on failure, staying in the confirm step", async () => {
    resetDemoAction.mockResolvedValue({ error: "La réinitialisation a échoué" });
    render(<ResetForm />);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser la démo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la réinitialisation" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("La réinitialisation a échoué");
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
