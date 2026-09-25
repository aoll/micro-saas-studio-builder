// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 4:
// on mount, calls claimSignupBonus(slug) once via a Server Action (same
// startTransition idiom as checkout's CheckoutFlow); a localStorage flag
// skips the call on a later mount in the same browser -- a pure
// optimization, not the correctness mechanism (that's covered
// independently by claim.test.ts's idempotency tests).
const claimSignupBonus = vi.fn();
vi.mock("../complete/_actions", () => ({ claimSignupBonus: (slug: string) => claimSignupBonus(slug) }));

afterEach(() => {
  cleanup();
  claimSignupBonus.mockReset();
  window.localStorage.clear();
});

describe("ClaimCrossProductBonus", () => {
  it("calls claimSignupBonus(slug) once on mount", async () => {
    claimSignupBonus.mockResolvedValue({ ok: true, balance: 3 });
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    await act(async () => {
      render(<ClaimCrossProductBonus slug="lettre-pro" />);
    });

    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(1));
    expect(claimSignupBonus).toHaveBeenCalledWith("lettre-pro");
  });

  it("renders nothing", async () => {
    claimSignupBonus.mockResolvedValue({ ok: true, balance: 3 });
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    let container: HTMLElement | undefined;
    await act(async () => {
      ({ container } = render(<ClaimCrossProductBonus slug="lettre-pro" />));
    });
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(1));
    expect(container!.innerHTML).toBe("");
  });

  it("sets a localStorage flag after a successful call, and a fresh mount for the same slug does not call again", async () => {
    claimSignupBonus.mockResolvedValue({ ok: true, balance: 3 });
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    const first = render(<ClaimCrossProductBonus slug="lettre-pro" />);
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(1));
    first.unmount();

    await act(async () => {
      render(<ClaimCrossProductBonus slug="lettre-pro" />);
    });
    // No new call: give any accidental async retry a tick to happen.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(claimSignupBonus).toHaveBeenCalledTimes(1);
  });

  it("still calls once per product: a different slug is not skipped by the other slug's flag", async () => {
    claimSignupBonus.mockResolvedValue({ ok: true, balance: 3 });
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    const first = render(<ClaimCrossProductBonus slug="lettre-pro" />);
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(1));
    first.unmount();

    await act(async () => {
      render(<ClaimCrossProductBonus slug="bio-instagram" />);
    });
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(2));
    expect(claimSignupBonus).toHaveBeenLastCalledWith("bio-instagram");
  });

  it("does not throw and does not set the flag when the call is rejected (retried on the next real page load)", async () => {
    claimSignupBonus.mockRejectedValue(new Error("network error"));
    const { ClaimCrossProductBonus } = await import("./claim-cross-product-bonus");

    const first = render(<ClaimCrossProductBonus slug="lettre-pro" />);
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(1));
    first.unmount();

    await act(async () => {
      render(<ClaimCrossProductBonus slug="lettre-pro" />);
    });
    await waitFor(() => expect(claimSignupBonus).toHaveBeenCalledTimes(2));
  });
});
