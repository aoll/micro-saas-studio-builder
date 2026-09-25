import { afterEach, describe, expect, it, vi } from "vitest";

describe("next.config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("enables the 4 Next.js 16.3 flags", async () => {
    const { default: config } = await import("./next.config");
    expect(config.cacheComponents).toBe(true);
    expect(config.partialPrefetching).toBe(true);
    expect(config.reactCompiler).toBe(true);
    expect(config.typedRoutes).toBe(true);
  });

  it("wires next-intl to i18n/request.ts", async () => {
    const { default: config } = await import("./next.config");
    expect(config.turbopack?.resolveAlias?.["next-intl/config"]).toContain("i18n/request");
  });

  it("fails to load without a complete environment", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    await expect(import("./next.config")).rejects.toThrow();
  });

  // SECURITY (plan, task 9): withBotId adds the rewrites and headers the
  // client-side BotID challenge script needs (docs/06-vercel.md), on top of
  // next-intl's own config. A light check, not a re-test of the botid
  // package: just that composing withBotId actually changed the config.
  it("adds BotID's rewrites and headers (withBotId)", async () => {
    const { default: config } = await import("./next.config");
    expect(typeof config.rewrites).toBe("function");
    const rewrites = await config.rewrites!();
    const flat = Array.isArray(rewrites) ? rewrites : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? [])];
    expect(flat.some((rule) => rule.destination.includes("bot-protection"))).toBe(true);

    expect(typeof config.headers).toBe("function");
    const headerRules = await config.headers!();
    expect(headerRules.some((rule) => rule.headers.some((h) => h.key === "X-Frame-Options"))).toBe(true);
  });
});
