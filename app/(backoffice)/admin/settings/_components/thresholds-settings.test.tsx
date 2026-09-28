// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/backoffice-settings.json";
import en from "@/messages/en/backoffice-settings.json";
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
    },
  ],
};

function renderUi(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-settings": locale === "fr" ? fr : en }}>
      <ThresholdsSettings view={VIEW} />
    </NextIntlClientProvider>,
  );
}

describe("ThresholdsSettings", () => {
  it("renders the defaults form and the product picker", () => {
    renderUi();
    expect(screen.getByText("Seuils par défaut du studio")).toBeTruthy();
    expect(screen.getByText(/Produit Deux \(surchargé\)/)).toBeTruthy();
  });

  it("renders in English with no French text left, including the overridden suffix", () => {
    renderUi("en");
    expect(screen.getByText("Studio default thresholds")).toBeTruthy();
    expect(screen.getByText("Per-product override")).toBeTruthy();
    expect(screen.getByText("Produit Deux (overridden)")).toBeTruthy();
    expect(screen.queryByText(/surchargé/)).toBeNull();
    expect(screen.queryByText(/à couper|à scaler/)).toBeNull();
  });

  it("shows the selected product's own merged values, and submits an override save bound to its id and locale", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    renderUi();
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p2" } });

    expect((screen.getByLabelText("Visites minimales (produit)") as HTMLInputElement).value).toBe("500");

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la surcharge" }));
    await vi.waitFor(() => expect(saveThresholdSettings).toHaveBeenCalled());
    const [productId, locale] = saveThresholdSettings.mock.calls[0]!;
    expect(productId).toBe("p2");
    expect(locale).toBe("fr");
  });

  it("resets the selected product's override, bound to its id and locale", async () => {
    resetProductThresholds.mockResolvedValue({ ok: true });
    renderUi();
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    await vi.waitFor(() => expect(resetProductThresholds).toHaveBeenCalled());
    const [productId, locale] = resetProductThresholds.mock.calls[0]!;
    expect(productId).toBe("p2");
    expect(locale).toBe("fr");
  });

  it("previews only the selected product when its own override changes", () => {
    renderUi();
    fireEvent.change(screen.getByLabelText(/produit à surcharger/i), { target: { value: "p1" } });
    const killInputs = screen.getAllByLabelText(/à couper/i);
    fireEvent.change(killInputs[killInputs.length - 1]!, { target: { value: "0.5" } });
    const previewed = screen.getAllByTestId("preview-change").map((node) => node.textContent);
    expect(previewed.some((text) => text?.includes("Produit Un"))).toBe(true);
    expect(previewed.some((text) => text?.includes("Produit Deux"))).toBe(false);
  });
});
