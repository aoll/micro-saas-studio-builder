import { describe, expectTypeOf, it } from "vitest";
import type { EventType } from "@/lib/schemas/event-type";
import type { ProductConfig, ProductStatus } from "@/lib/schemas/product-config";
import type { DebitResult, Purchase } from "./credits";

// Permanent contract tests (specs/CONTRACT-types.md): pin the *type* of
// every frozen signature with `expectTypeOf`. Unlike stubs.test.ts, this
// file stays valid once a real implementation replaces a stub's body.

describe("credits", () => {
  // This is the first dynamic import in the file, so it alone pays for
  // transforming and initializing the whole shared foundation this module
  // pulls in (drizzle-orm, the postgres driver, lib/db, lib/db/schema,
  // lib/env, better-auth via lib/dal/session) — every later `await
  // import(...)` in this file hits Vite's transform cache and takes single
  // digit milliseconds. Measured standalone: ~1.3s; with the machine's 4
  // cores saturated by other work, ~1.4-1.5s. Under real full-suite
  // parallelism (up to 10 worktrees, 4 test slots each cold-starting the
  // same kind of import), this legitimately crossed the default 5000ms
  // once. Raised for this test only, not the suite default, since no other
  // test here does comparable first-import work.
  it("debit takes a single Debit argument and returns a DebitResult", async () => {
    const { debit } = await import("./credits");
    expectTypeOf(debit).parameters.toEqualTypeOf<[import("./credits").Debit]>();
    expectTypeOf(debit).returns.resolves.toEqualTypeOf<DebitResult>();
  }, 20_000);

  it("DebitResult's refusal is a value, never an exception", () => {
    expectTypeOf<Extract<DebitResult, { ok: false }>>().toEqualTypeOf<{
      ok: false;
      reason: "insufficient_balance";
    }>();
  });

  it("getBalance takes a userId and a productId and returns a number", async () => {
    const { getBalance } = await import("./credits");
    expectTypeOf(getBalance).parameters.toEqualTypeOf<[userId: string, productId: string]>();
    expectTypeOf(getBalance).returns.resolves.toEqualTypeOf<number>();
  });

  it("refund takes a generationId and returns void", async () => {
    const { refund } = await import("./credits");
    expectTypeOf(refund).parameters.toEqualTypeOf<[generationId: string]>();
    expectTypeOf(refund).returns.resolves.toEqualTypeOf<void>();
  });

  it("grantSignupBonus takes { userId, productId } and returns a balance", async () => {
    const { grantSignupBonus } = await import("./credits");
    expectTypeOf(grantSignupBonus).parameters.toEqualTypeOf<[args: { userId: string; productId: string }]>();
    expectTypeOf(grantSignupBonus).returns.resolves.toEqualTypeOf<{ balance: number }>();
  });

  it("purchase takes a single Purchase argument and returns a balance", async () => {
    const { purchase } = await import("./credits");
    expectTypeOf(purchase).parameters.toEqualTypeOf<[Purchase]>();
    expectTypeOf(purchase).returns.resolves.toEqualTypeOf<{ balance: number }>();
  });
});

describe("generations", () => {
  it("recordGeneration takes a NewGeneration and returns an id", async () => {
    const { recordGeneration } = await import("./generations");
    expectTypeOf(recordGeneration).parameters.toEqualTypeOf<[import("./generations").NewGeneration]>();
    expectTypeOf(recordGeneration).returns.resolves.toEqualTypeOf<{ id: string }>();
  });

  it("saveGeneration takes a generationId and a GenerationResult", async () => {
    const { saveGeneration } = await import("./generations");
    expectTypeOf(saveGeneration).parameters.toEqualTypeOf<
      [generationId: string, result: import("./generations").GenerationResult]
    >();
    expectTypeOf(saveGeneration).returns.resolves.toEqualTypeOf<void>();
  });

  it("markGenerationFailed takes a generationId", async () => {
    const { markGenerationFailed } = await import("./generations");
    expectTypeOf(markGenerationFailed).parameters.toEqualTypeOf<[generationId: string]>();
    expectTypeOf(markGenerationFailed).returns.resolves.toEqualTypeOf<void>();
  });
});

describe("events", () => {
  it("track takes a TrackEvent with a typed EventType", async () => {
    const { track } = await import("./events");
    expectTypeOf(track).parameters.toEqualTypeOf<[import("./events").TrackEvent]>();
    expectTypeOf(track).returns.resolves.toEqualTypeOf<void>();
    expectTypeOf<import("./events").TrackEvent["type"]>().toEqualTypeOf<EventType>();
  });
});

describe("products", () => {
  it("Product extends ProductConfig with id, version and isSeed", () => {
    expectTypeOf<import("./products").Product>().toMatchTypeOf<ProductConfig>();
    expectTypeOf<import("./products").Product>().toMatchTypeOf<{
      id: string;
      version: number;
      isSeed: boolean;
    }>();
  });

  it("listProducts takes no argument and returns Product[]", async () => {
    const { listProducts } = await import("./products");
    expectTypeOf(listProducts).parameters.toEqualTypeOf<[]>();
    expectTypeOf(listProducts).returns.resolves.toEqualTypeOf<import("./products").Product[]>();
  });
});

describe("themes", () => {
  it("getTheme takes an id and returns a Theme or null", async () => {
    const { getTheme } = await import("./themes");
    expectTypeOf(getTheme).parameters.toEqualTypeOf<[id: string]>();
    expectTypeOf(getTheme).returns.resolves.toEqualTypeOf<import("./themes").Theme | null>();
  });
});

describe("product-editor", () => {
  it("createProduct takes a ProductConfig and returns id, slug, version", async () => {
    const { createProduct } = await import("./product-editor");
    expectTypeOf(createProduct).parameters.toEqualTypeOf<[config: ProductConfig]>();
    expectTypeOf(createProduct).returns.resolves.toEqualTypeOf<{ id: string; slug: string; version: number }>();
  });
});

describe("product-status", () => {
  it("updateStatus takes a productId, a ProductStatus and a nullable note", async () => {
    const { updateStatus } = await import("./product-status");
    expectTypeOf(updateStatus).parameters.toEqualTypeOf<
      [productId: string, status: ProductStatus, note: string | null]
    >();
    expectTypeOf(updateStatus).returns.resolves.toEqualTypeOf<void>();
  });
});

describe("magic-link", () => {
  it("getLatestMagicLink takes an email and returns a url and createdAt, or null", async () => {
    const { getLatestMagicLink } = await import("./magic-link");
    expectTypeOf(getLatestMagicLink).parameters.toEqualTypeOf<[email: string]>();
    expectTypeOf(getLatestMagicLink).returns.resolves.toEqualTypeOf<{ url: string; createdAt: Date } | null>();
  });
});

describe("metrics", () => {
  it("getPortfolioMetrics takes a MetricsRange and returns PortfolioMetrics", async () => {
    const { getPortfolioMetrics } = await import("./metrics");
    expectTypeOf(getPortfolioMetrics).parameters.toEqualTypeOf<[range: import("./metrics").MetricsRange]>();
    expectTypeOf(getPortfolioMetrics).returns.resolves.toEqualTypeOf<import("./metrics").PortfolioMetrics>();
  });

  it("getFunnel takes a productId and a MetricsRange and returns a Funnel", async () => {
    const { getFunnel } = await import("./metrics");
    expectTypeOf(getFunnel).parameters.toEqualTypeOf<[productId: string, range: import("./metrics").MetricsRange]>();
    expectTypeOf(getFunnel).returns.resolves.toEqualTypeOf<import("./metrics").Funnel>();
  });

  it("FunnelStep's type is one of the 5 funnel steps (no generation)", () => {
    expectTypeOf<import("./metrics").FunnelStep["type"]>().toEqualTypeOf<
      "visit" | "first_generation" | "signup" | "credits_exhausted" | "purchase"
    >();
  });
});

describe("thresholds", () => {
  it("getThresholds takes a productId and returns Thresholds", async () => {
    const { getThresholds } = await import("./thresholds");
    expectTypeOf(getThresholds).parameters.toEqualTypeOf<[productId: string]>();
    expectTypeOf(getThresholds).returns.resolves.toEqualTypeOf<import("./thresholds").Thresholds>();
  });
});

describe("security", () => {
  it("guardRequest takes a GuardKind and returns a GuardResult", async () => {
    const { guardRequest } = await import("@/lib/security");
    expectTypeOf(guardRequest).parameters.toEqualTypeOf<[kind: import("@/lib/security").GuardKind]>();
    expectTypeOf(guardRequest).returns.resolves.toEqualTypeOf<import("@/lib/security").GuardResult>();
  });

  it("GuardKind has exactly the 4 kinds cited by SA-02, SA-03, SA-05 and BO-05b", () => {
    expectTypeOf<import("@/lib/security").GuardKind>().toEqualTypeOf<
      "generate" | "signup" | "purchase" | "test-prompt"
    >();
  });
});

// Characterization tests (SETUP-skeleton, real code, no red phase): pin the
// existing signatures so a later spec cannot silently change them.
describe("session (SETUP-skeleton)", () => {
  it("requireAdmin returns a Session", async () => {
    const { requireAdmin } = await import("./session");
    expectTypeOf(requireAdmin).returns.resolves.toEqualTypeOf<import("./session").Session>();
  });

  it("getSession returns a Session or null", async () => {
    const { getSession } = await import("./session");
    expectTypeOf(getSession).returns.resolves.toEqualTypeOf<import("./session").Session | null>();
  });
});

describe("products (SETUP-skeleton)", () => {
  it("getProduct takes a single slug argument", async () => {
    const { getProduct } = await import("./products");
    expectTypeOf(getProduct).parameters.toEqualTypeOf<[slug: string]>();
  });

  // CONTRACT-data widens getProduct's return type from the skeleton's raw
  // row to `Product | null` (task 4 of the plan).
  it("getProduct returns Product | null", async () => {
    const { getProduct } = await import("./products");
    expectTypeOf(getProduct).returns.resolves.toEqualTypeOf<import("./products").Product | null>();
  });
});
