// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

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

describe("ThemeEditor", () => {
  it("renders the 16 light color fields with their current values", () => {
    render(<ThemeEditor theme={theme} readOnly={false} />);
    expect((screen.getByLabelText("Background") as HTMLInputElement).value).toBe(LIGHT.background);
    expect((screen.getByLabelText("Card foreground") as HTMLInputElement).value).toBe(LIGHT.cardForeground);
    expect((screen.getByLabelText("Ring") as HTMLInputElement).value).toBe(LIGHT.ring);
  });

  it("switches to the dark tokens when the mode switch is used", () => {
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Sombre" }));
    expect((screen.getByLabelText("Background") as HTMLInputElement).value).toBe(DARK.background);
  });

  it("updates a color field and reflects it in the submitted payload", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.change(screen.getByLabelText("Primary"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , formData] = saveTheme.mock.calls[0]!;
    expect(payloadOf(formData as FormData).tokens.light.primary).toBe("#123456");
  });

  it("changes the font key through the typography select", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.change(screen.getByLabelText("Police"), { target: { value: "rounded" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , formData] = saveTheme.mock.calls[0]!;
    expect(payloadOf(formData as FormData).tokens.fontKey).toBe("rounded");
  });

  it("changes the radius through the slider and shows its readout", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.change(screen.getByLabelText("Radius"), { target: { value: "1" } });
    expect(screen.getByText("1rem")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , formData] = saveTheme.mock.calls[0]!;
    expect(payloadOf(formData as FormData).tokens.radius).toBe("1rem");
  });

  it("changes the landing variant through its select", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.change(screen.getByLabelText("Variante de landing"), { target: { value: "split" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , formData] = saveTheme.mock.calls[0]!;
    expect(payloadOf(formData as FormData).landingVariant).toBe("split");
  });

  it("shows field errors returned by the action, with aria-invalid, and a banner", async () => {
    saveTheme.mockResolvedValue({ errors: { "tokens.light.background": "Doit être une couleur CSS valide" } });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Doit être une couleur CSS valide");
    expect(screen.getByLabelText("Background").getAttribute("aria-invalid")).toBe("true");
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
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Doit être une couleur CSS valide");
    expect(describedTextOf(screen.getByLabelText("Primary"))).toBe("Doit être une couleur CSS valide");
  });

  it("wires the font, radius and landing variant errors the same way", async () => {
    saveTheme.mockResolvedValue({
      errors: {
        "tokens.fontKey": "Police hors catalogue",
        "tokens.radius": "Doit être une longueur CSS en rem ou px",
        landingVariant: "Variante invalide",
      },
    });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await screen.findByText("Police hors catalogue");
    expect(describedTextOf(screen.getByLabelText("Police"))).toBe("Police hors catalogue");
    expect(describedTextOf(screen.getByLabelText("Radius"))).toBe("Doit être une longueur CSS en rem ou px");
    expect(describedTextOf(screen.getByLabelText("Variante de landing"))).toBe("Variante invalide");
  });

  it("has no accessible description on a field with no error", () => {
    render(<ThemeEditor theme={theme} readOnly={false} />);
    expect(screen.getByLabelText("Background").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Police").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Radius").getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByLabelText("Variante de landing").getAttribute("aria-describedby")).toBeNull();
  });

  it("shows a success toast when the save succeeds", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("shows an error toast on a form-level error", async () => {
    saveTheme.mockResolvedValue({ formError: "Thème introuvable" });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Thème introuvable"));
  });

  it("disables every field and the save button when read-only", () => {
    render(<ThemeEditor theme={theme} readOnly={true} />);
    expect((screen.getByLabelText("Background") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("links back to the theme library through 'Annuler'", () => {
    render(<ThemeEditor theme={theme} readOnly={false} />);
    expect(screen.getByRole("link", { name: "Annuler" }).getAttribute("href")).toBe("/admin/themes");
  });

  it("does nothing destructive when submitted with no changes (payload matches the original theme)", async () => {
    saveTheme.mockResolvedValue({ ok: true });
    render(<ThemeEditor theme={theme} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(saveTheme).toHaveBeenCalled());
    const [, , formData] = saveTheme.mock.calls[0]!;
    expect(payloadOf(formData as FormData)).toEqual({ tokens, landingVariant: "centered" });
    await act(() => Promise.resolve());
  });

  it("shows a live preview whose colors follow the draft as it is edited", () => {
    render(<ThemeEditor theme={theme} readOnly={false} />);
    const preview = screen.getByTestId("theme-preview");
    expect(preview.style.getPropertyValue("--primary")).toBe(LIGHT.primary);

    fireEvent.change(screen.getByLabelText("Primary"), { target: { value: "#123456" } });
    expect(preview.style.getPropertyValue("--primary")).toBe("#123456");
  });

  it("passes the sample product name through to the preview headline", () => {
    render(<ThemeEditor theme={theme} readOnly={false} sampleProductName="LettrePro" />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
  });
});
