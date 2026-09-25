import { describe, expect, it } from "vitest";
import fr from "@/messages/fr/pricing.json";
import en from "@/messages/en/pricing.json";

// One zone file per namespace (docs/09-arborescence.md): fr and en must
// carry the exact same keys, mirroring i18n/load-messages.test.ts's parity
// check for the common zone.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages/pricing", () => {
  it("has identical key paths in fr and en", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it("has the keys the pricing page needs", () => {
    expect(fr.title).toBe("Plus de crédits ?");
    expect(fr.titleAccent).toBe("Rechargez.");
    expect(en.title).toBe("Need more credits?");
    expect(en.titleAccent).toBe("Top up.");
  });
});
