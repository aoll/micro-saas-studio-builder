// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettingsView } from "./settings-view";

const { saveThresholdSettings, resetProductThresholds, toastSuccess, toastError } = vi.hoisted(() => ({
  saveThresholdSettings: vi.fn(),
  resetProductThresholds: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../_actions", () => ({ saveThresholdSettings, resetProductThresholds }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ThresholdsSettings } = await import("./thresholds-settings");

afterEach(() => {
  cleanup();
  saveThresholdSettings.mockReset();
  resetProductThresholds.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

const VIEW: SettingsView = {
  defaults: {
    values: { minVisits: 1000, killMaxConversion: 0.02, scaleMinConversion: 0.05, scaleRequiresPositiveMargin: true },
    isSeed: true,
    editable: true,
  },
  products: [
    {
      productId: "p1",
      name: "Produit Un",
      status: "test",
      isSeed: false,
      visits: 2000,
      signupToPurchaseRate: 0.01,
      marginPerGenerationMicros: 500,
      override: null,
      editable: true,
    },
    {
      productId: "p2",
      name: "Produit Deux",
      status: "learn",
      isSeed: false,
      visits: 500,
      signupToPurchaseRate: null,
      marginPerGenerationMicros: null,
      override: {
        minVisits: 500,
        killMaxConversion: null,
        scaleMinConversion: null,
        scaleRequiresPositiveMargin: null,
      },
      editable: true,
    },
  ],
};

describe("ThresholdsSettings", () => {
  it("renders the defaults form and the product picker", () => {
    render(<ThresholdsSettings view={VIEW} />);
    expect(screen.getByText("Seuils par défaut du studio")).toBeTruthy();
    expect(screen.getByText(/Produit Deux \(surchargé\)/)).toBeTruthy();
  });

  it("shows the selected product's own merged values, and submits an override save bound to its id", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    render(<ThresholdsSettings view={VIEW} />);
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p2" } });

    expect((screen.getByLabelText("Visites minimales (produit)") as HTMLInputElement).value).toBe("500");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la surcharge" }));
    await vi.waitFor(() => expect(saveThresholdSettings).toHaveBeenCalled());
    const [productId] = saveThresholdSettings.mock.calls[0]!;
    expect(productId).toBe("p2");
  });

  it("resets the selected product's override", async () => {
    resetProductThresholds.mockResolvedValue({ ok: true });
    render(<ThresholdsSettings view={VIEW} />);
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    await vi.waitFor(() => expect(resetProductThresholds).toHaveBeenCalled());
    const [productId] = resetProductThresholds.mock.calls[0]!;
    expect(productId).toBe("p2");
  });

  it("previews only the selected product when its own override changes", () => {
    render(<ThresholdsSettings view={VIEW} />);
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p1" } });
    const killInputs = screen.getAllByLabelText(/à couper/i);
    fireEvent.change(killInputs[killInputs.length - 1]!, { target: { value: "0.5" } });
    const previewed = screen.getAllByTestId("preview-change").map((node) => node.textContent);
    expect(previewed.some((text) => text?.includes("Produit Un"))).toBe(true);
    expect(previewed.some((text) => text?.includes("Produit Deux"))).toBe(false);
  });

  it("locks the defaults form but keeps a visitor product's override editable (demo mode)", () => {
    const view: SettingsView = { ...VIEW, defaults: { ...VIEW.defaults, editable: false } };
    render(<ThresholdsSettings view={view} />);
    expect((screen.getByLabelText("Visites minimales") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Visites minimales (produit)") as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Enregistrer la surcharge" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("locks a seeded product's override form and its reset (demo mode)", () => {
    const view: SettingsView = {
      ...VIEW,
      products: VIEW.products.map((product) => ({ ...product, isSeed: true, editable: false })),
    };
    render(<ThresholdsSettings view={view} />);
    expect((screen.getByLabelText("Visites minimales (produit)") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Réinitialiser" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
