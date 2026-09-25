import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { products, themes } from "@/lib/db/schema";
import { landingVariantSchema, themeTokensSchema, type ThemeTokens } from "@/lib/schemas/theme-tokens";
import { SEED_OWNER } from "@/scripts/seed";

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

const requireAdmin = vi.fn();
vi.mock("./session", () => ({ requireAdmin: () => requireAdmin() }));

const mockAssertEditable = vi.fn();
vi.mock("./guards", async () => {
  const actual = await vi.importActual<typeof import("./guards")>("./guards");
  return { ...actual, assertEditable: (row: unknown) => mockAssertEditable(row) };
});

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
  requireAdmin.mockReset();
  mockAssertEditable.mockReset();
});

async function currentAdmin() {
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  requireAdmin.mockResolvedValue({ user: { id: owner!.id, role: "admin" } });
  return owner!.id;
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

function buildTokens(overrides: Partial<ThemeTokens> = {}): ThemeTokens {
  return {
    light: { ...COLOR_SET },
    dark: { ...COLOR_SET, background: "#000000" },
    fontKey: "sans",
    radius: "0.5rem",
    ...overrides,
  };
}

async function createTempTheme(overrides: Partial<{ isSeed: boolean }> = {}) {
  const [row] = await db
    .insert(themes)
    .values({
      slug: `temp-theme-${randomUUID()}`,
      name: "Temp theme",
      tokens: buildTokens(),
      landingVariant: "centered",
      isSeed: overrides.isSeed ?? false,
    })
    .returning({ id: themes.id });
  return row!.id;
}

describe("getTheme", () => {
  it("resolves the seeded editorial theme with valid tokens", async () => {
    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    const { getTheme } = await import("./themes");
    const theme = await getTheme(editorial!.id);
    expect(theme).toMatchObject({ id: editorial!.id, slug: "editorial", isSeed: true });
    expect(themeTokensSchema.safeParse(theme?.tokens).success).toBe(true);
    expect(cacheTag).toHaveBeenCalledWith(`theme:${editorial!.id}`);
    expect(cacheLife).toHaveBeenCalledWith("max");
  });

  it("resolves to null for an unknown (but valid) uuid", async () => {
    const { getTheme } = await import("./themes");
    expect(await getTheme(randomUUID())).toBeNull();
  });

  it("resolves to null for a non-uuid without hitting the database", async () => {
    const { getTheme } = await import("./themes");
    expect(await getTheme("not-a-uuid")).toBeNull();
  });
});

describe("updateTheme", () => {
  it("redirects a non-admin caller", async () => {
    requireAdmin.mockRejectedValue(new RedirectMarker("/admin/login"));
    const { updateTheme } = await import("./themes");
    await expect(updateTheme(randomUUID(), { tokens: buildTokens(), landingVariant: "centered" })).rejects.toThrow(
      "redirect:/admin/login",
    );
  });

  it("returns null for a non-uuid id without hitting the database", async () => {
    await currentAdmin();
    const { updateTheme } = await import("./themes");
    expect(mockAssertEditable).not.toHaveBeenCalled();
    expect(await updateTheme("not-a-uuid", { tokens: buildTokens(), landingVariant: "centered" })).toBeNull();
    expect(mockAssertEditable).not.toHaveBeenCalled();
  });

  it("returns null for an unknown (valid) uuid", async () => {
    await currentAdmin();
    const { updateTheme } = await import("./themes");
    expect(await updateTheme(randomUUID(), { tokens: buildTokens(), landingVariant: "centered" })).toBeNull();
  });

  it("rejects invalid tokens without writing", async () => {
    await currentAdmin();
    const themeId = await createTempTheme();
    const { updateTheme } = await import("./themes");
    await expect(
      updateTheme(themeId, {
        tokens: buildTokens({ light: { ...COLOR_SET, background: "not-a-color" } }),
        landingVariant: "centered",
      }),
    ).rejects.toThrow();

    const row = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });
    expect((row?.tokens as ThemeTokens).light.background).toBe("#111111");

    await db.delete(themes).where(eq(themes.id, themeId));
  });

  it("persists tokens, landing variant and updatedAt, calling assertEditable first", async () => {
    await currentAdmin();
    const themeId = await createTempTheme();
    const before = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });

    const { updateTheme } = await import("./themes");
    const nextTokens = buildTokens({ light: { ...COLOR_SET, primary: "oklch(0.5 0.2 250)" } });
    const result = await updateTheme(themeId, { tokens: nextTokens, landingVariant: "split" });

    expect(result).toMatchObject({ id: themeId, productSlugs: [] });
    expect(mockAssertEditable).toHaveBeenCalledWith(expect.objectContaining({ isSeed: false }));

    const after = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });
    expect(after?.landingVariant).toBe("split");
    expect((after?.tokens as ThemeTokens).light.primary).toBe("oklch(0.5 0.2 250)");
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());

    // getTheme's own contract stays untouched: the same row still parses.
    expect(themeTokensSchema.safeParse(after?.tokens).success).toBe(true);
    expect(landingVariantSchema.safeParse(after?.landingVariant).success).toBe(true);

    await db.delete(themes).where(eq(themes.id, themeId));
  });

  it("rejects when assertEditable throws, without writing", async () => {
    await currentAdmin();
    const themeId = await createTempTheme({ isSeed: true });
    mockAssertEditable.mockImplementation(() => {
      throw new Error("locked");
    });

    const { updateTheme } = await import("./themes");
    await expect(updateTheme(themeId, { tokens: buildTokens(), landingVariant: "split" })).rejects.toThrow("locked");

    const row = await db.query.themes.findFirst({ where: eq(themes.id, themeId) });
    expect(row?.landingVariant).toBe("centered");

    await db.delete(themes).where(eq(themes.id, themeId));
  });

  it("returns the sorted slugs of every product on the theme, killed included", async () => {
    const ownerId = await currentAdmin();
    const themeId = await createTempTheme();
    const [zeta, alpha, killedProduct] = await Promise.all([
      db
        .insert(products)
        .values({
          slug: `temp-zeta-${randomUUID()}`,
          status: "test",
          themeId,
          currentVersion: 1,
          locale: "fr",
          createdBy: ownerId,
        })
        .returning({ slug: products.slug }),
      db
        .insert(products)
        .values({
          slug: `temp-alpha-${randomUUID()}`,
          status: "test",
          themeId,
          currentVersion: 1,
          locale: "fr",
          createdBy: ownerId,
        })
        .returning({ slug: products.slug }),
      db
        .insert(products)
        .values({
          slug: `temp-killed-${randomUUID()}`,
          status: "killed",
          themeId,
          currentVersion: 1,
          locale: "fr",
          createdBy: ownerId,
        })
        .returning({ slug: products.slug }),
    ]);

    const { updateTheme } = await import("./themes");
    const result = await updateTheme(themeId, { tokens: buildTokens(), landingVariant: "minimal" });

    expect(result?.productSlugs).toEqual([alpha[0]!.slug, killedProduct[0]!.slug, zeta[0]!.slug].sort());

    await db.delete(products).where(eq(products.themeId, themeId));
    await db.delete(themes).where(eq(themes.id, themeId));
  });
});
