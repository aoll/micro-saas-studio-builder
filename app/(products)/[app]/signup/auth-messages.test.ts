import { describe, expect, it } from "vitest";
import fr from "@/messages/fr/auth.json";
import en from "@/messages/en/auth.json";

// SA-03 (specs/SA-03-inscription.md): fr/en parity for the new `auth` zone,
// mirroring messages/pricing.test.ts's parity check for the pricing zone.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages/auth", () => {
  it("has identical key paths in fr and en", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it("has the keys the signup flow needs", () => {
    expect(fr.submit).toBe("Recevoir mon lien de connexion");
    expect(en.submit).toBe("Get my sign-in link");
    expect(fr.inbox.cta).toBe("Me connecter");
    expect(en.inbox.cta).toBe("Sign me in");
    expect(fr.expired.resend).toBe("Recevoir un nouveau lien");
    expect(en.expired.resend).toBe("Get a new link");
  });
});
