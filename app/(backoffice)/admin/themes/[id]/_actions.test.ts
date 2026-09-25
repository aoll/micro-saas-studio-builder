import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const requireAdmin = vi.fn();
vi.mock("@/lib/dal/session", () => ({ requireAdmin: () => requireAdmin() }));

const updateTheme = vi.fn();
vi.mock("@/lib/dal/themes", () => ({ updateTheme: (...args: unknown[]) => updateTheme(...args) }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));

// _actions.ts imports lib/fonts.ts for FONT_KEYS; next/font/google's real
// module only exists at Next.js build time (lib/fonts.test.ts).
vi.mock("next/font/google", () => {
  const loader = () => ({ variable: "--font-theme", className: "font-mock" });
  return { Fraunces: loader, Space_Grotesk: loader, Inter: loader, Nunito: loader };
});

afterEach(() => {
  requireAdmin.mockReset();
  updateTheme.mockReset();
  updateTag.mockReset();
});

function currentAdmin() {
  requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
}

const COLOR_SET = {
  background: "#111111",
  foreground: "#222222",
  card: "#333333",
  cardForeground: "#444444",
  primary: "#555555",
  primaryForeground: "#666666",
  secondary: "#777777",
  secondaryForeground: "#888888",
  muted: "#999999",
  mutedForeground: "#aaaaaa",
  accent: "#bbbbbb",
  accentForeground: "#cccccc",
  destructive: "#dddddd",
  border: "#eeeeee",
  input: "#ffffff",
  ring: "#000000",
};

function validTokens(overrides: Partial<ThemeTokens> = {}): ThemeTokens {
  return {
    light: { ...COLOR_SET },
    dark: { ...COLOR_SET, background: "#000000" },
    fontKey: "sans",
    radius: "0.5rem",
    ...overrides,
  };
}

function formDataFor(payload: unknown): FormData {
  const data = new FormData();
  data.set("payload", JSON.stringify(payload));
  return data;
}

describe("saveTheme", () => {
  it("checks admin before anything else", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { saveTheme } = await import("./_actions");
    await expect(saveTheme(randomUUID(), {}, formDataFor({}))).rejects.toThrow("redirect:/admin/login");
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("returns a form error for a non-uuid id, without calling the DAL", async () => {
    currentAdmin();
    const { saveTheme } = await import("./_actions");
    const result = await saveTheme(
      "not-a-uuid",
      {},
      formDataFor({ tokens: validTokens(), landingVariant: "centered" }),
    );
    expect(result.formError).toBe("Thème introuvable");
    expect(updateTheme).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("returns a form error for unreadable JSON", async () => {
    currentAdmin();
    const { saveTheme } = await import("./_actions");
    const data = new FormData();
    data.set("payload", "{not json");
    const result = await saveTheme(randomUUID(), {}, data);
    expect(result.formError).toBe("Données illisibles");
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("returns a field error for an invalid color, without calling the DAL", async () => {
    currentAdmin();
    const { saveTheme } = await import("./_actions");
    const bad = validTokens({ light: { ...COLOR_SET, background: "not-a-color" } });
    const result = await saveTheme(randomUUID(), {}, formDataFor({ tokens: bad, landingVariant: "centered" }));
    expect(result.errors?.["tokens.light.background"]).toBeTruthy();
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("returns a field error for a fontKey outside the catalogue", async () => {
    currentAdmin();
    const { saveTheme } = await import("./_actions");
    const bad = validTokens({ fontKey: "comic-sans" });
    const result = await saveTheme(randomUUID(), {}, formDataFor({ tokens: bad, landingVariant: "centered" }));
    expect(result.errors?.["tokens.fontKey"]).toBe("Police hors catalogue");
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("returns a field error for an invalid landing variant", async () => {
    currentAdmin();
    const { saveTheme } = await import("./_actions");
    const result = await saveTheme(
      randomUUID(),
      {},
      formDataFor({ tokens: validTokens(), landingVariant: "not-a-variant" }),
    );
    expect(result.errors?.landingVariant).toBeTruthy();
    expect(updateTheme).not.toHaveBeenCalled();
  });

  it("on the happy path, calls updateTheme then tags the theme and every product on it", async () => {
    currentAdmin();
    const id = randomUUID();
    updateTheme.mockResolvedValue({ id, productSlugs: ["alpha", "zeta"] });
    const { saveTheme } = await import("./_actions");
    const result = await saveTheme(id, {}, formDataFor({ tokens: validTokens(), landingVariant: "split" }));

    expect(result).toEqual({ ok: true });
    expect(updateTheme).toHaveBeenCalledWith(id, {
      tokens: validTokens(),
      landingVariant: "split" satisfies LandingVariant,
    });
    expect(updateTag).toHaveBeenCalledWith(`theme:${id}`);
    expect(updateTag).toHaveBeenCalledWith("product:alpha");
    expect(updateTag).toHaveBeenCalledWith("product:zeta");
    expect(updateTag).toHaveBeenCalledTimes(3);
  });

  it("returns a form error when the DAL returns null (theme not found / removed mid-flight), no tag update", async () => {
    currentAdmin();
    updateTheme.mockResolvedValue(null);
    const { saveTheme } = await import("./_actions");
    const result = await saveTheme(
      randomUUID(),
      {},
      formDataFor({ tokens: validTokens(), landingVariant: "centered" }),
    );
    expect(result.formError).toBe("Thème introuvable");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rethrows a DAL error without tagging", async () => {
    currentAdmin();
    updateTheme.mockRejectedValue(new Error("locked"));
    const { saveTheme } = await import("./_actions");
    await expect(
      saveTheme(randomUUID(), {}, formDataFor({ tokens: validTokens(), landingVariant: "centered" })),
    ).rejects.toThrow("locked");
    expect(updateTag).not.toHaveBeenCalled();
  });
});
