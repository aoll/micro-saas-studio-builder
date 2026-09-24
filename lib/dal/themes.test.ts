import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { themeTokensSchema } from "@/lib/schemas/theme-tokens";

const cacheLife = vi.fn();
const cacheTag = vi.fn();
vi.mock("next/cache", () => ({ cacheLife, cacheTag }));

afterEach(() => {
  cacheLife.mockClear();
  cacheTag.mockClear();
});

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
