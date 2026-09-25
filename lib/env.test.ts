import { describe, expect, it } from "vitest";
import { createAppEnv } from "./env";

const validSource = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/msb",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  AI_MODE: "mock",
  DEMO_MODE: "false",
  AI_GATEWAY_API_KEY: "gw-key",
  BLOB_READ_WRITE_TOKEN: "blob-token",
  CRON_SECRET: "cron-secret",
};

describe("createAppEnv", () => {
  it("parses a complete valid source", () => {
    const env = createAppEnv(validSource);
    expect(env.AI_MODE).toBe("mock");
    expect(env.DEMO_MODE).toBe(false);
    expect(env.DATABASE_URL).toBe(validSource.DATABASE_URL);
  });

  it.each(Object.keys(validSource))("throws when %s is missing", (key) => {
    const source = { ...validSource };
    delete (source as Record<string, string>)[key];
    expect(() => createAppEnv(source)).toThrow();
  });

  it.each(Object.keys(validSource))("throws when %s is an empty string", (key) => {
    const source = { ...validSource, [key]: "" };
    expect(() => createAppEnv(source)).toThrow();
  });

  it("throws on an invalid AI_MODE", () => {
    expect(() => createAppEnv({ ...validSource, AI_MODE: "foo" })).toThrow();
  });

  it("throws on a DATABASE_URL that is not a URL", () => {
    expect(() => createAppEnv({ ...validSource, DATABASE_URL: "not-a-url" })).toThrow();
  });
});

// GENERATION_RATE_LIMIT_PER_MINUTE (SECURITY): optional, defaults to 10.
// Kept out of `validSource` and its `it.each` loops (missing/empty-string):
// it is optional, so those loops would fail for this one key.
describe("createAppEnv › GENERATION_RATE_LIMIT_PER_MINUTE", () => {
  it("defaults to 10 when absent", () => {
    const env = createAppEnv(validSource);
    expect(env.GENERATION_RATE_LIMIT_PER_MINUTE).toBe(10);
  });

  it("parses a provided positive integer", () => {
    const env = createAppEnv({ ...validSource, GENERATION_RATE_LIMIT_PER_MINUTE: "25" });
    expect(env.GENERATION_RATE_LIMIT_PER_MINUTE).toBe(25);
  });

  it("throws on 0", () => {
    expect(() => createAppEnv({ ...validSource, GENERATION_RATE_LIMIT_PER_MINUTE: "0" })).toThrow();
  });

  it("throws on a non-numeric value", () => {
    expect(() => createAppEnv({ ...validSource, GENERATION_RATE_LIMIT_PER_MINUTE: "abc" })).toThrow();
  });
});

// VERCEL (SECURITY follow-up): Vercel sets this to "1" automatically at
// build time and at runtime; absent everywhere else (local, self-hosted).
// Optional, kept out of `validSource` for the same reason as
// GENERATION_RATE_LIMIT_PER_MINUTE above.
describe("createAppEnv › VERCEL", () => {
  it("is undefined when absent", () => {
    const env = createAppEnv(validSource);
    expect(env.VERCEL).toBeUndefined();
  });

  it('accepts "1"', () => {
    const env = createAppEnv({ ...validSource, VERCEL: "1" });
    expect(env.VERCEL).toBe("1");
  });
});
