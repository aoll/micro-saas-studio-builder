// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "@/lib/dal/themes";
import type { ThemeTokens } from "@/lib/schemas/theme-tokens";

vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

const { ThemeStep } = await import("./theme-step");

afterEach(cleanup);

const tokens: ThemeTokens = {
  light: {
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
  },
  dark: {
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
  },
  fontKey: "serif",
  radius: "0.5rem",
};

const themeOptions: Theme[] = [
  { id: "theme-editorial", slug: "editorial", name: "Editorial", tokens, landingVariant: "centered", isSeed: true },
  { id: "theme-neon", slug: "neon", name: "Neon", tokens, landingVariant: "split", isSeed: true },
];

function setup(overrides: Partial<React.ComponentProps<typeof ThemeStep>> = {}) {
  const onChange = vi.fn();
  const onUploadLogo = vi.fn();
  const props: React.ComponentProps<typeof ThemeStep> = {
    themes: themeOptions,
    themeId: "theme-editorial",
    branding: {},
    errors: {},
    onChange,
    onUploadLogo,
    ...overrides,
  };
  const view = render(<ThemeStep {...props} />);
  return { onChange, onUploadLogo, ...view };
}

describe("ThemeStep", () => {
  it("renders one thumbnail per theme in a radiogroup, the current one checked", () => {
    setup();
    const group = screen.getByRole("radiogroup");
    const options = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(options).toHaveLength(2);
    const checked = options.find((option) => option.getAttribute("aria-checked") === "true");
    expect(checked?.textContent).toContain("Editorial");
  });

  it("selects a theme on click", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText("Neon"));
    expect(onChange).toHaveBeenCalledWith({ themeId: "theme-neon" });
  });

  it("uploads a logo and stores its url in branding", async () => {
    const { onChange, onUploadLogo } = setup();
    onUploadLogo.mockResolvedValue({ url: "https://blob.example/logo.png" });
    const file = new File([new Uint8Array(10)], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [file] } });

    await waitFor(() => expect(onUploadLogo).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ branding: { logoUrl: "https://blob.example/logo.png" } }),
    );
  });

  it("shows an error message when the logo upload fails", async () => {
    const { onUploadLogo } = setup();
    onUploadLogo.mockResolvedValue({ error: "Le logo dépasse 512 Ko" });
    const file = new File([new Uint8Array(10)], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Logo"), { target: { files: [file] } });

    await screen.findByText("Le logo dépasse 512 Ko");
  });

  it("accepts a hex colour and stores it in branding", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Couleur du thème"), { target: { value: "#d946ef" } });
    expect(onChange).toHaveBeenLastCalledWith({ branding: { primaryColor: "#d946ef" } });
  });

  it("clears the colour override", () => {
    const { onChange } = setup({ branding: { primaryColor: "#d946ef" } });
    fireEvent.click(screen.getByRole("button", { name: "Effacer la couleur" }));
    expect(onChange).toHaveBeenCalledWith({ branding: {} });
  });
});
