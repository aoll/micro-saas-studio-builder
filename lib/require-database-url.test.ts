import { describe, expect, it } from "vitest";
import { requireDatabaseUrl } from "./require-database-url";

describe("requireDatabaseUrl", () => {
  it("returns DATABASE_URL from the given source", () => {
    expect(requireDatabaseUrl({ DATABASE_URL: "postgres://x" })).toBe("postgres://x");
  });

  it("throws a readable error when DATABASE_URL is missing", () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });

  it("throws when DATABASE_URL is an empty string", () => {
    expect(() => requireDatabaseUrl({ DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("defaults to process.env when no source is given", () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://from-process-env";
    try {
      expect(requireDatabaseUrl()).toBe("postgres://from-process-env");
    } finally {
      process.env.DATABASE_URL = previous;
    }
  });
});
