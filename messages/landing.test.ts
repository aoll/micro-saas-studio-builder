import { describe, expect, it } from "vitest";
import fr from "./fr/landing.json";
import en from "./en/landing.json";

// SA-01 ships its own zone (CLAUDE.md: each spec ships messages/*/<zone>.json
// in French and English). Same shape check as i18n/load-messages.test.ts's
// "identical key paths" test, scoped to this zone.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages/{fr,en}/landing.json", () => {
  it("have identical key paths", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it("carries the French copy used across the landing sections", () => {
    expect(fr.hero.cta).toBe("Essayer gratuitement");
    expect(fr.example.title).toBe("Exemple de résultat");
    expect(fr.steps.title).toBe("Comment ça marche");
    expect(fr.pricing.title).toBe("Tarifs");
    expect(fr.pricing.cta).toBe("Commencer");
    expect(fr.faq.title).toBe("Questions fréquentes");
  });

  it("carries the English copy used across the landing sections", () => {
    expect(en.hero.cta).toBe("Try it free");
  });
});
