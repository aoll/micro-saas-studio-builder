import { afterEach, describe, expect, it, vi } from "vitest";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 3:
// claimSignupBonus(slug) Server Action, called once per browser per
// product by the new client leaf (step 4). Mirrors checkout/_actions.ts's
// purchase() unit test style: every dependency mocked.
//
// Security review follow-up (guardRequest("signup")): mirrors
// signup/_actions.ts's requestMagicLink and checkout/_actions.ts's
// purchase, both gated by guardRequest before any DAL write. Every test
// below that expects delegation now arranges `guardRequest` to resolve
// `{ ok: true }` first (a new collaborator, not a weakened assertion); two
// new tests cover the guard itself.
const claimSignupBonus = vi.fn();
vi.mock("./_lib/claim", () => ({ claimSignupBonus: (slug: string) => claimSignupBonus(slug) }));

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const guardRequest = vi.fn();
vi.mock("@/lib/security", () => ({ guardRequest: (kind: string) => guardRequest(kind) }));

afterEach(() => {
  claimSignupBonus.mockReset();
  refresh.mockReset();
  guardRequest.mockReset();
});

describe("claimSignupBonus action", () => {
  it("returns { ok: false } for an invalid slug, without calling the guard or the helper", async () => {
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("Not A Valid Slug!")).resolves.toEqual({ ok: false });
    expect(guardRequest).not.toHaveBeenCalled();
    expect(claimSignupBonus).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: false } and does not call the helper when the guard refuses (bot or rate limit)", async () => {
    guardRequest.mockResolvedValue({ ok: false, reason: "bot" });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("lettre-pro")).resolves.toEqual({ ok: false });
    expect(guardRequest).toHaveBeenCalledWith("signup");
    expect(claimSignupBonus).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("calls the guard before delegating to the helper when the product is unknown", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    claimSignupBonus.mockResolvedValue({ status: "not_found" });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("unknown-product")).resolves.toEqual({ ok: false });
    expect(guardRequest).toHaveBeenCalledWith("signup");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: false } and does not refresh when there is no session (guard ok)", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    claimSignupBonus.mockResolvedValue({ status: "no_session" });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("lettre-pro")).resolves.toEqual({ ok: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: true, balance } and calls refresh() once when the guard passes and the bonus is granted", async () => {
    guardRequest.mockResolvedValue({ ok: true });
    claimSignupBonus.mockResolvedValue({ status: "granted", balance: 3 });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("lettre-pro")).resolves.toEqual({ ok: true, balance: 3 });
    expect(guardRequest).toHaveBeenCalledWith("signup");
    expect(claimSignupBonus).toHaveBeenCalledWith("lettre-pro");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
