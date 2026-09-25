import { describe, expect, it, vi } from "vitest";
import { loadMessages } from "./load-messages";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("loadMessages", () => {
  it("loads the fr common zone", async () => {
    const messages = await loadMessages("fr");
    expect((messages.common as { header: { signIn: string } }).header.signIn).toBe("Connexion");
  });

  it("loads the en common zone", async () => {
    const messages = await loadMessages("en");
    expect((messages.common as { header: { signIn: string } }).header.signIn).toBe("Sign in");
  });

  it("has identical key paths in fr and en common", async () => {
    const fr = await loadMessages("fr");
    const en = await loadMessages("en");
    expect(keyPaths(fr.common).sort()).toEqual(keyPaths(en.common).sort());
  });
});

describe("loadMessages with a broken manifest (guards the Turbopack glob regression)", () => {
  it("throws when the manifest has no entry at all for the locale", async () => {
    vi.resetModules();
    vi.doMock("@/messages/manifest", () => ({ default: { "./en/common.json": { header: {} } } }));
    const { loadMessages: brokenLoadMessages } = await import("./load-messages");
    await expect(brokenLoadMessages("fr")).rejects.toThrow(
      "loadMessages(fr): no messages resolved, check messages/manifest.ts",
    );
    vi.doUnmock("@/messages/manifest");
    vi.resetModules();
  });

  it("throws when the locale resolves files but none of them is the common zone", async () => {
    vi.resetModules();
    vi.doMock("@/messages/manifest", () => ({ default: { "./fr/tool.json": { title: "Outil" } } }));
    const { loadMessages: brokenLoadMessages } = await import("./load-messages");
    await expect(brokenLoadMessages("fr")).rejects.toThrow(
      "loadMessages(fr): no messages resolved, check messages/manifest.ts",
    );
    vi.doUnmock("@/messages/manifest");
    vi.resetModules();
  });
});
