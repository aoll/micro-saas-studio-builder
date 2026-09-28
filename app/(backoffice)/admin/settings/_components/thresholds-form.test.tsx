// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Thresholds } from "@/lib/dal/thresholds";
import fr from "@/messages/fr/backoffice-settings.json";
import en from "@/messages/en/backoffice-settings.json";
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

function renderUi(ui: React.ReactElement, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-settings": locale === "fr" ? fr : en }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ThresholdsForm", () => {
  it("shows the seeded defaults as percents", () => {
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />);
    expect((screen.getByLabelText(/visites minimales/i) as HTMLInputElement).value).toBe("1000");
    expect((screen.getByLabelText(/à couper/i) as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText(/à scaler/i) as HTMLInputElement).value).toBe("5");
  });

  it("renders in English when the current locale is en, with no French text left", () => {
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />, "en");
    expect(screen.getByText("Studio default thresholds")).toBeTruthy();
    expect(screen.getByLabelText('"Cut" conversion (%)')).toBeTruthy();
    expect(screen.getByLabelText('"Scale" conversion (%)')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByText(/à couper|à scaler/)).toBeNull();
  });

  it("submits the form's own values and the current locale, converting percent back to a rate", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />);
    fireEvent.change(screen.getByLabelText(/à couper/i), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveThresholdSettings).toHaveBeenCalled());
    const [productId, locale, , formData] = saveThresholdSettings.mock.calls[0]!;
    expect(productId).toBeNull();
    expect(locale).toBe("fr");
    expect(payloadOf(formData as FormData)).toMatchObject({ killMaxConversion: "3", minVisits: "1000" });
  });

  it("binds the en locale when the surrounding provider is set to en", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />, "en");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(saveThresholdSettings).toHaveBeenCalled());
    const [, locale] = saveThresholdSettings.mock.calls[0]!;
    expect(locale).toBe("en");
  });

  it("shows a toast on success", async () => {
    saveThresholdSettings.mockResolvedValue({ ok: true });
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Seuils par défaut enregistrés"));
  });

  it("shows the field error returned by the action", async () => {
    saveThresholdSettings.mockResolvedValue({
      errors: { scaleMinConversion: "Le seuil « à scaler » doit être supérieur au seuil « à couper »" },
    });
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await screen.findByText("Le seuil « à scaler » doit être supérieur au seuil « à couper »");
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
    renderUi(<ThresholdsForm defaults={DEFAULTS} products={products} />);
    fireEvent.change(screen.getByLabelText(/à couper/i), { target: { value: "0.5" } });
    expect(screen.getByText(/Produit Un/)).toBeTruthy();
  });
});
