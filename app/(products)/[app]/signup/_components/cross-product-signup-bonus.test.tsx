// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 5:
// the server-side gate rendered from a <Suspense> in [app]/layout.tsx (step
// 6), mirroring header-balance.test.tsx's "call the async component
// directly" pattern: no session -> null, so an anonymous visitor and the
// pre-rendered landing shell never mount the client leaf.
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession }));

// ClaimCrossProductBonus (the child rendered below) imports the real
// Server Action module, which transitively imports server-only DAL code
// (lib/dal/credits.ts) that rejects running in this jsdom test environment
// (@t3-oss/env-core's client/server split). This test only checks which
// element type and props CrossProductSignupBonus returns, never the
// child's own behavior (covered independently by
// claim-cross-product-bonus.test.tsx), so the action module is stubbed out.
vi.mock("../complete/_actions", () => ({ claimSignupBonus: vi.fn() }));

afterEach(() => {
  getSession.mockReset();
});

describe("CrossProductSignupBonus", () => {
  it("returns null when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const { CrossProductSignupBonus } = await import("./cross-product-signup-bonus");

    const ui = await CrossProductSignupBonus({ slug: "lettre-pro" });
    expect(ui).toBeNull();
  });

  it("renders ClaimCrossProductBonus with the slug when a session exists", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const { CrossProductSignupBonus } = await import("./cross-product-signup-bonus");
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    const ui = await CrossProductSignupBonus({ slug: "lettre-pro" });
    expect(ui?.type).toBe(ClaimCrossProductBonus);
    expect(ui?.props).toEqual({ slug: "lettre-pro" });
  });
});
