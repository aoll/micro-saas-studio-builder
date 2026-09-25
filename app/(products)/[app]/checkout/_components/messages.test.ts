import { describe, expect, it } from "vitest";
import fr from "@/messages/fr/checkout.json";
import en from "@/messages/en/checkout.json";

// SA-05 (specs/SA-05-paiement.md): the checkout zone's messages, fr/en
// parity, colocated here rather than under messages/ (mirroring
// messages/pricing.test.ts) because messages/*.json is the only
// non-test file this spec's Périmètre allows outside [app]/checkout/**
// and @modal/(.)checkout/**.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("messages/checkout", () => {
  it("has identical key paths in fr and en", () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it("has the keys the checkout flow needs", () => {
    expect(fr.modal.title).toBe("Paiement");
    expect(fr.modal.titleConfirmed).toBe("Paiement confirmé");
    expect(en.modal.title).toBe("Payment");
    expect(en.modal.titleConfirmed).toBe("Payment confirmed");
  });

  it("has a message for every purchase error", () => {
    const errors = ["unauthenticated", "invalid_request", "unknown_pack", "bot", "rate_limited", "failed"] as const;
    for (const error of errors) {
      expect(fr.errors[error]).toBeTruthy();
      expect(en.errors[error]).toBeTruthy();
    }
  });
});
