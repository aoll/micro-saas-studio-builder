import { afterEach, describe, expect, it, vi } from "vitest";

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
    await expect(resetDemoAction({}, new FormData())).rejects.toThrow("redirect:/admin/login");
    expect(resetDemo).not.toHaveBeenCalled();
  });

  it("rejects an admin who is not the owner, without calling resetDemo", async () => {
    requireAdmin.mockResolvedValue({ user: { id: "admin-id", role: "admin" } });
    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction({}, new FormData());
    expect(result.error).toBeTruthy();
    expect(resetDemo).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("resets and tags products, thresholds, every product seen before the reset, and every seeded theme", async () => {
    stubHappyPath();
    const { resetDemoAction } = await import("./_actions");
    const result = await resetDemoAction({}, new FormData());

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
    const result = await resetDemoAction({}, new FormData());

    expect(result.error).toBeTruthy();
    expect(result.ok).toBeUndefined();
    expect(updateTag).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
