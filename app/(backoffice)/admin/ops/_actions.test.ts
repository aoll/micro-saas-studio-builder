import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const requireAdmin = vi.fn();
vi.mock("@/lib/dal/session", () => ({ requireAdmin: () => requireAdmin() }));

const listProducts = vi.fn();
vi.mock("@/lib/dal/products", () => ({ listProducts: () => listProducts() }));

const listThemeOptions = vi.fn();
vi.mock("@/lib/dal/product-editor", () => ({ listThemeOptions: () => listThemeOptions() }));

const resetDemo = vi.fn();
vi.mock("@/scripts/reset-demo", () => ({ resetDemo: (...args: unknown[]) => resetDemo(...args) }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));

// resetDemoAction() (I18N-BACKOFFICE-STRINGS spec "Server Actions") calls
// getTranslations({ locale, namespace }) with the explicit locale it
// receives, after requireAdmin() (the guard stays the action's first call).
// next-intl/server is mocked with a real translator, like the login action.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
    createTranslator({
      locale,
      messages: { "backoffice-portfolio": locale === "fr" ? fr : en },
      namespace: namespace as never,
    }),
}));

afterEach(() => {
  requireAdmin.mockReset();
  listProducts.mockReset();
  listThemeOptions.mockReset();
  resetDemo.mockReset();
  updateTag.mockReset();
});

function stubHappyPath() {
  requireAdmin.mockResolvedValue({ user: { id: "owner-id", role: "owner" } });
  listProducts.mockResolvedValue([
    { slug: "lettre-pro" },
    { slug: "descri-pro" },
    { slug: "nom-de-marque" },
    { slug: "a-visitor-product" },
  ]);
  listThemeOptions.mockResolvedValue([
    { id: "theme-editorial", isSeed: true },
    { id: "theme-neon", isSeed: true },
    { id: "theme-corporate", isSeed: true },
    { id: "theme-playful", isSeed: true },
  ]);
  resetDemo.mockResolvedValue(undefined);
}

describe("resetDemoAction", () => {
  it("redirects a non-admin caller (requireAdmin's own redirect)", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { resetDemoAction } = await import("./_actions");
    await expect(resetDemoAction("fr", {}, new FormData())).rejects.toThrow("redirect:/admin/login");
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("rejects an admin who is not the owner, without calling resetDemo", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction("fr", {}, new FormData());
    expect(result.error).toBe("Réservé au propriétaire de la démo");
    expect(resetDemo).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("resets and tags products, thresholds, every product seen before the reset, and every seeded theme", async () => {
    stubHappyPath();
    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction("fr", {}, new FormData());

    expect(result.ok).toBe(true);
    expect(resetDemo).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith("products");
    expect(updateTag).toHaveBeenCalledWith("thresholds");
    expect(updateTag).toHaveBeenCalledWith("product:lettre-pro");
    expect(updateTag).toHaveBeenCalledWith("product:descri-pro");
    expect(updateTag).toHaveBeenCalledWith("product:nom-de-marque");
    expect(updateTag).toHaveBeenCalledWith("product:a-visitor-product");
    expect(updateTag).toHaveBeenCalledWith("theme:theme-editorial");
    expect(updateTag).toHaveBeenCalledWith("theme:theme-neon");
    expect(updateTag).toHaveBeenCalledWith("theme:theme-corporate");
    expect(updateTag).toHaveBeenCalledWith("theme:theme-playful");
  });

  it("returns a form error and logs when resetDemo rejects, without tagging", async () => {
    stubHappyPath();
    resetDemo.mockRejectedValue(new Error("db exploded"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction("fr", {}, new FormData());

    expect(result.error).toBe("La réinitialisation a échoué");
    expect(result.ok).toBeUndefined();
    expect(updateTag).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // I18N-BACKOFFICE-STRINGS: error messages respect the explicit locale.
  it("returns English error messages when given the en locale", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction("en", {}, new FormData());
    expect(result.error).toBe("Reserved to the demo's owner");
  });
});
