import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// SA-05 (specs/SA-05-paiement.md): purchase(slug, packId, idempotencyKey)
// server action. Every dependency mocked here (unit test); the real ledger
// and events run in _actions.ledger.test.ts against the shared DB.
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

const purchaseCredits = vi.fn();
vi.mock("@/lib/dal/credits", () => ({ purchase: (args: unknown) => purchaseCredits(args) }));

const track = vi.fn();
vi.mock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));

const guardRequest = vi.fn();
vi.mock("@/lib/security", () => ({ guardRequest: (kind: string) => guardRequest(kind) }));

// next/server's after() and next/cache's refresh() both need a real request
// context this unit test never sets up (route.test.ts's same trick):
// after() just collects tasks, refresh() is a no-op spy.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (task: unknown) => {
      afterCallbacks.push(typeof task === "function" ? (task as () => unknown) : () => task);
    },
  };
});
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

afterEach(() => {
  afterCallbacks.length = 0;
  getSession.mockReset();
  getProduct.mockReset();
  purchaseCredits.mockReset();
  track.mockReset();
  guardRequest.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

async function flushAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

function currentUser(userId = "user-1") {
  getSession.mockResolvedValue({ user: { id: userId, role: "user" } });
}

const product = {
  id: "product-1",
  version: 1,
  isSeed: true,
  slug: "bio-insta",
  name: "BioInsta",
  status: "test" as const,
  themeId: "theme-1",
  locale: "fr" as const,
  branding: {},
  landing: { headline: "h", subheadline: "s", faq: [], seoTitle: "t", seoDescription: "d" },
  inputs: [{ key: "topic", label: "Topic", type: "text" as const, required: true }],
  generation: { model: "anthropic/claude-haiku", promptTemplate: "hello", outputType: "markdown" as const },
  pricing: {
    freeCreditsOnSignup: 3,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [
      { id: "pack-10", credits: 10, priceCents: 490 },
      { id: "pack-50", credits: 50, priceCents: 1490, recommended: true },
    ],
  },
};

describe("purchase", () => {
  it("returns unauthenticated when there is no session, without touching anything else", async () => {
    getSession.mockResolvedValue(null);
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(getProduct).not.toHaveBeenCalled();
    expect(guardRequest).not.toHaveBeenCalled();
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a malformed slug, without calling the DAL", async () => {
    currentUser();
    const { purchase } = await import("./_actions");
    const result = await purchase("Not A Slug!", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a non-uuid idempotency key, without calling the DAL", async () => {
    currentUser();
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", "not-a-uuid");
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("maps a bot guard result before reading the product", async () => {
    currentUser();
    guardRequest.mockResolvedValue({ ok: false, reason: "bot" });
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "bot" });
    expect(getProduct).not.toHaveBeenCalled();
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("maps a rate_limited guard result", async () => {
    currentUser();
    guardRequest.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "rate_limited" });
  });

  it("returns invalid_request for an unknown product, without calling the DAL", async () => {
    currentUser();
    getProduct.mockResolvedValue(null);
    const { purchase } = await import("./_actions");
    const result = await purchase("unknown-slug", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("returns invalid_request for a killed product", async () => {
    currentUser();
    getProduct.mockResolvedValue({ ...product, status: "killed" });
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());
    expect(result).toEqual({ ok: false, error: "invalid_request" });
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("returns unknown_pack for a packId absent from the product's config, before any write", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-999", randomUUID());
    expect(result).toEqual({ ok: false, error: "unknown_pack" });
    expect(purchaseCredits).not.toHaveBeenCalled();
  });

  it("on the happy path, credits the ledger, tracks a purchase event, and refreshes", async () => {
    currentUser("user-1");
    getProduct.mockResolvedValue(product);
    purchaseCredits.mockResolvedValue({ balance: 50 });
    const key = randomUUID();

    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-50", key);

    expect(result).toEqual({ ok: true, balance: 50 });
    expect(purchaseCredits).toHaveBeenCalledWith({
      userId: "user-1",
      productId: "product-1",
      packId: "pack-50",
      idempotencyKey: key,
    });
    expect(refresh).toHaveBeenCalledOnce();

    await flushAfterCallbacks();
    expect(track).toHaveBeenCalledWith({
      type: "purchase",
      productId: "product-1",
      userId: "user-1",
      anonymousId: null,
      metadata: { packId: "pack-50", credits: 50, amountCents: 1490, purchaseKey: key },
    });
  });

  it("logs but never throws when the after() tracking call rejects", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    purchaseCredits.mockResolvedValue({ balance: 10 });
    track.mockRejectedValue(new Error("events down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());
    expect(result).toEqual({ ok: true, balance: 10 });

    await expect(flushAfterCallbacks()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns failed and does not refresh or track when the ledger throws", async () => {
    currentUser();
    getProduct.mockResolvedValue(product);
    purchaseCredits.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { purchase } = await import("./_actions");
    const result = await purchase("bio-insta", "pack-10", randomUUID());

    expect(result).toEqual({ ok: false, error: "failed" });
    expect(refresh).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
