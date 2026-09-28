// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";
import en from "@/messages/en/backoffice-themes.json";
import fr from "@/messages/fr/backoffice-themes.json";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const { saveTheme, toastSuccess, toastError } = vi.hoisted(() => ({
  saveTheme: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../_actions", () => ({ saveTheme }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { ThemeEditor } = await import("./theme-editor");

afterEach(() => {
  cleanup();
  saveTheme.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

// I18N-BACKOFFICE-STRINGS (lot 7): ThemeEditor is 'use client' and reads
// its own locale/translations (useLocale/useTranslations from "next-intl"),
// like locale-switcher.tsx — wrapped with the provider, like
// signup-prompt.test.tsx.
function renderUi(ui: React.ReactElement, locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-themes": locale === "en" ? en : fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const LIGHT = {
  background: "#faf7f2",
  foreground: "#2b2620",
  card: "#ffffff",
  cardForeground: "#2b2620",
  primary: "#8a5a34",
  primaryForeground: "#ffffff",
  secondary: "#efe7da",
  secondaryForeground: "#2b2620",
  muted: "#efe7da",
  mutedForeground: "#6b6357",
  accent: "#cbb994",
  accentForeground: "#2b2620",
  destructive: "#b3261e",
  border: "#e3dccb",
  input: "#e3dccb",
  ring: "#8a5a34",
};

const DARK = {
  background: "#1c1712",
  foreground: "#f4efe4",
  card: "#251f18",
  cardForeground: "#f4efe4",
  primary: "#c98f5e",
  primaryForeground: "#1c1712",
  secondary: "#332a20",
  secondaryForeground: "#f4efe4",
  muted: "#332a20",
  mutedForeground: "#b3a891",
  accent: "#8a5a34",
  accentForeground: "#f4efe4",
  destructive: "#ff6961",
  border: "#3a3025",
  input: "#3a3025",
  ring: "#c98f5e",
};

const tokens: ThemeTokens = { light: LIGHT, dark: DARK, fontKey: "serif", radius: "0.5rem" };

const theme: Theme = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "editorial",
  name: "Editorial",
  tokens,
  landingVariant: "centered",
  isSeed: false,
};

function payloadOf(formData: FormData): { tokens: ThemeTokens; landingVariant: string } {
  return JSON.parse(formData.get("payload") as string);
}

// saveTheme is bound with `.bind(null, theme.id, locale)`: useActionState
// then calls it with (prevState, formData), so every invocation the mock
// records is [id, locale, prevState, formData].
function lastCall() {
  return saveTheme.mock.calls[0]! as [string, string, unknown, FormData];
}

describe("ThemeEditor", () => {
  it("renders the 16 light color fields with their current values", () => {
    renderUi(<ThemeEditor theme={theme} />);
    expect((screen.getByLabelText("Arrière-plan") as HTMLInputElement).value).toBe(LIGHT.background);
    expect((screen.getByLabelText("Texte de la carte") as HTMLInputElement).value).toBe(LIGHT.cardForeground);
    expect((screen.getByLabelText("Anneau de focus") as HTMLInputElement).value).toBe(LIGHT.ring);
  });

  it("switches to the dark tokens when the mode switch is used", () => {
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Sombre" }));
    expect((screen.getByLabelText("Arrière-plan") as HTMLInputElement).value).toBe(DARK.background);
  });

  it("updates a color field and reflects it in the submitted payload", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.change(screen.getByLabelText("Primaire"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , , formData] = lastCall();
    expect(payloadOf(formData).tokens.light.primary).toBe("#123456");
  });

  it("binds the theme id and the current locale ahead of the action's own (prevState, formData) pair", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />, "en");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [id, locale] = lastCall();
    expect(id).toBe(theme.id);
    expect(locale).toBe("en");
  });

  it("changes the font key through the typography select", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.change(screen.getByLabelText("Police"), { target: { value: "rounded" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , , formData] = lastCall();
    expect(payloadOf(formData).tokens.fontKey).toBe("rounded");
  });

  it("changes the radius through the slider and shows its readout", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.change(screen.getByLabelText("Radius"), { target: { value: "1" } });
    expect(screen.getByText("1rem")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , , formData] = lastCall();
    expect(payloadOf(formData).tokens.radius).toBe("1rem");
  });

  it("changes the landing variant through its select", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.change(screen.getByLabelText("Variante de landing"), { target: { value: "split" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , , formData] = lastCall();
    expect(payloadOf(formData).landingVariant).toBe("split");
  });

  it("shows field errors returned by the action, with aria-invalid, and a banner", async () => {
    saveTheme.mockResolvedValue({ errors: { "tokens.light.background": "Doit être une couleur CSS valide" } });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Doit être une couleur CSS valide");
    expect(screen.getByLabelText("Arrière-plan").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  // A screen reader announces a control's accessible description (the
  // element(s) named by `aria-describedby`) alongside its label: without
  // that wiring, the error `<p>` is only a sighted hint next to the field.
  function describedTextOf(control: HTMLElement): string | null {
    const id = control.getAttribute("aria-describedby");
    if (!id) return null;
    return document.getElementById(id)?.textContent ?? null;
  }

  it("wires a color field's error as its accessible description via aria-describedby", async () => {
    saveTheme.mockResolvedValue({ errors: { "tokens.light.primary": "Doit être une couleur CSS valide" } });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Doit être une couleur CSS valide");
    expect(describedTextOf(screen.getByLabelText("Primaire"))).toBe("Doit être une couleur CSS valide");
  });

  it("wires the font, radius and landing variant errors the same way", async () => {
    saveTheme.mockResolvedValue({
      errors: {
        "tokens.fontKey": "Police hors catalogue",
        "tokens.radius": "Doit être une longueur CSS en rem ou px",
        landingVariant: "Variante invalide",
      },
    });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Police hors catalogue");
    expect(describedTextOf(screen.getByLabelText("Police"))).toBe("Police hors catalogue");
    expect(describedTextOf(screen.getByLabelText("Radius"))).toBe("Doit être une longueur CSS en rem ou px");
    expect(describedTextOf(screen.getByLabelText("Variante de landing"))).toBe("Variante invalide");
  });

  it("has no accessible description on a field with no error", () => {
    renderUi(<ThemeEditor theme={theme} />);
    expect(screen.getByLabelText("Arrière-plan").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Police").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Radius").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Variante de landing").getAttribute("aria-describedby")).toBeNull();
  });

  it("shows a success toast when the save succeeds", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("shows an error toast on a form-level error", async () => {
    saveTheme.mockResolvedValue({ formError: "Thème introuvable" });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Thème introuvable"));
  });

  it("links back to the theme library through 'Annuler'", () => {
    renderUi(<ThemeEditor theme={theme} />);
    expect(screen.getByRole("link", { name: "Annuler" }).getAttribute("href")).toBe("/admin/themes");
  });

  it("does nothing destructive when submitted with no changes (payload matches the original theme)", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    renderUi(<ThemeEditor theme={theme} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , , formData] = lastCall();
    expect(payloadOf(formData)).toEqual({ tokens, landingVariant: "centered" });
    await act(() => Promise.resolve());
  });

  it("shows a live preview whose colors follow the draft as it is edited", () => {
    renderUi(<ThemeEditor theme={theme} />);
    const preview = screen.getByTestId("theme-preview");
    expect(preview.style.getPropertyValue("--primary")).toBe(LIGHT.primary);

    fireEvent.change(screen.getByLabelText("Primaire"), { target: { value: "#123456" } });
    expect(preview.style.getPropertyValue("--primary")).toBe("#123456");
  });

  it("passes the sample product name through to the preview headline", () => {
    renderUi(<ThemeEditor theme={theme} sampleProductName="LettrePro" />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
  });

  it("renders every section, mode, field and action label translated for the en locale", () => {
    renderUi(<ThemeEditor theme={theme} />, "en");
    expect(screen.getByLabelText("Background")).toBeTruthy();
    expect(screen.getByLabelText("Primary")).toBeTruthy();
    expect(screen.getByLabelText("Card foreground")).toBeTruthy();
    expect(screen.getByText("Colors")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dark" })).toBeTruthy();
    expect(screen.getByText("Typography")).toBeTruthy();
    expect(screen.getByLabelText("Font")).toBeTruthy();
    expect(screen.getByText("Shape")).toBeTruthy();
    expect(screen.getByLabelText("Radius")).toBeTruthy();
    expect(screen.getByLabelText("Landing variant")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("shows the en error banner text", async () => {
    saveTheme.mockResolvedValue({ errors: { "tokens.light.background": "Must be a valid CSS color" } });
    renderUi(<ThemeEditor theme={theme} />, "en");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("This theme has errors.");
  });
});
