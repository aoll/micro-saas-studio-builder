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

  it("fails to load without a complete environment", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
    await expect(import("./next.config")).rejects.toThrow();
  });
});
