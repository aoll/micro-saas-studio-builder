import { afterEach, describe, expect, it, vi } from "vitest";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 3:
// claimSignupBonus(slug) Server Action, called once per browser per
// product by the new client leaf (step 4). Mirrors checkout/_actions.ts's
// purchase() unit test style: every dependency mocked.
const claimSignupBonus = vi.fn();
vi.mock("./_lib/claim", () => ({ claimSignupBonus: (slug: string) => claimSignupBonus(slug) }));

const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

afterEach(() => {
  claimSignupBonus.mockReset();
  refresh.mockReset();
});

describe("claimSignupBonus action", () => {
  it("returns { ok: false } for an invalid slug, without calling the helper", async () => {
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("Not A Valid Slug!")).resolves.toEqual({ ok: false });
    expect(claimSignupBonus).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: false } and does not refresh when the product is unknown", async () => {
    claimSignupBonus.mockResolvedValue({ status: "not_found" });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("unknown-product")).resolves.toEqual({ ok: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: false } and does not refresh when there is no session", async () => {
    claimSignupBonus.mockResolvedValue({ status: "no_session" });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("lettre-pro")).resolves.toEqual({ ok: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns { ok: true, balance } and calls refresh() once when granted", async () => {
    claimSignupBonus.mockResolvedValue({ status: "granted", balance: 3 });
    const { claimSignupBonus: action } = await import("./_actions");

    await expect(action("lettre-pro")).resolves.toEqual({ ok: true, balance: 3 });
    expect(claimSignupBonus).toHaveBeenCalledWith("lettre-pro");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
