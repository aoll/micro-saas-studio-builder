// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Thresholds } from "@/lib/dal/thresholds";
import type { PreviewProduct } from "./preview";

const { saveThresholdSettings, toastSuccess, toastError } = vi.hoisted(() => ({
  saveThresholdSettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../_actions", () => ({ saveThresholdSettings }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ThresholdsForm } = await import("./thresholds-form");

afterEach(() => {
  cleanup();
  saveThresholdSettings.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

const DEFAULTS: Thresholds = {
  minVisits: 1000,
  killMaxConversion: 0.02,
  scaleMinConversion: 0.05,
  scaleRequiresPositiveMargin: true,
};

function payloadOf(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

describe("ThresholdsForm", () => {
  it("shows the seeded defaults as percents", () => {
    render(<ThresholdsForm defaults={DEFAULTS} products={[]} editable={true} />);
    expect((screen.getByLabelText(/visites minimales/i) as HTMLInputElement).value).toBe("1000");
    expect((screen.getByLabelText(/à couper/i) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/à scaler/i) as HTMLInputElement).value).toBe("5");
  });

  it("submits the form's own values, converting percent back to a rate", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    render(<ThresholdsForm defaults={DEFAULTS} products={[]} editable={true} />);
    fireEvent.change(screen.getByLabelText(/à couper/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveThresholdSettings).toHaveBeenCalled());
    const [productId, , formData] = saveThresholdSettings.mock.calls[0]!;
    expect(productId).toBeNull();
    expect(payloadOf(formData as FormData)).toMatchObject({ killMaxConversion: "3", minVisits: "1000" });
  });

  it("shows a toast on success", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    render(<ThresholdsForm defaults={DEFAULTS} products={[]} editable={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("shows the French field error returned by the action", async () => {
    saveThresholdSettings.mockResolvedValue({
      errors: { scaleMinConversion: "Le seuil « à scaler » doit être supérieur au seuil « à couper »" },
    });
    render(<ThresholdsForm defaults={DEFAULTS} products={[]} editable={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Le seuil « à scaler » doit être supérieur au seuil « à couper »");
  });

  it("disables every field and the submit button when not editable", () => {
    render(<ThresholdsForm defaults={DEFAULTS} products={[]} editable={false} />);
    expect((screen.getByLabelText(/visites minimales/i) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("previews a product whose badge would change before saving", () => {
    const products: PreviewProduct[] = [
      {
        productId: "p1",
        name: "Produit Un",
        visits: 2000,
        signupToPurchaseRate: 0.01,
        marginPerGenerationMicros: 500,
        override: null,
      },
    ];
    render(<ThresholdsForm defaults={DEFAULTS} products={products} editable={true} />);
    fireEvent.change(screen.getByLabelText(/à couper/i), { target: { value: "0.5" } });
    expect(screen.getByText(/Produit Un/)).toBeTruthy();
  });
});
