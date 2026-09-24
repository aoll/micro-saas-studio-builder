import { describe, expect, it } from "vitest";
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
