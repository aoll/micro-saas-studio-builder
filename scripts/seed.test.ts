// specs/CONTRACT-data.md (orchestrator decision 1): SETUP-skeleton's `demo`
// placeholder product is replaced by LettrePro, seeded from
// fixtures/lettre-pro.config.json against the full data model.
// specs/DEMO-mode.md extends this file with DescriPro, NomDeMarque, the
// deterministic usage generator (buildSeedUsage) and the credentials
// refusal.
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { evaluate } from "../lib/decision";
import { productConfigSchema } from "../lib/schemas/product-config";
import { themeTokensSchema } from "../lib/schemas/theme-tokens";
import { accounts, users } from "../lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import {
  SEED_ADMIN,
  SEED_OWNER,
  SEED_USAGE_TARGETS,
  buildSeedUsage,
  resolveCredentials,
  seed,
  seedUsageWindow,
  startOfUtcDay,
  type ProductUsageTarget,
} from "./seed";

const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { products, productVersions, themes, decisionThresholds, users, accounts } });

const sessionUserId = { current: "" };
vi.mock("@/lib/dal/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dal/session")>("@/lib/dal/session");
  return {
    ...actual,
    getSession: async () => ({ user: { id: sessionUserId.current, role: "owner" } }),
    requireAdmin: async () => ({ user: { id: sessionUserId.current, role: "owner" } }),
  };
});
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

beforeAll(async () => {
  await seed();
  await seed(); // idempotent: run twice on purpose
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  sessionUserId.current = owner!.id;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("seed", () => {
  it("creates no demo product", async () => {
    const rows = await db.select().from(products).where(eq(products.slug, "demo"));
    expect(rows).toHaveLength(0);
  });

  it("creates exactly the 4 seeded themes, each with valid tokens", async () => {
    const rows = await db.select().from(themes).where(eq(themes.isSeed, true));
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.slug).sort()).toEqual(["corporate", "editorial", "neon", "playful"]);
    for (const row of rows) {
      expect(themeTokensSchema.safeParse(row.tokens).success).toBe(true);
    }
  });

  it("creates exactly one lettre-pro product, seeded, scale, editorial theme, fr", async () => {
    const rows = await db.select().from(products).where(eq(products.slug, "lettre-pro"));
    expect(rows).toHaveLength(1);
    const product = rows[0]!;
    expect(product.status).toBe("scale");
    expect(product.isSeed).toBe(true);
    expect(product.currentVersion).toBe(1);
    expect(product.locale).toBe("fr");

    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    expect(product.themeId).toBe(editorial?.id);

    const versionRows = await db.select().from(productVersions).where(eq(productVersions.productId, product.id));
    expect(versionRows).toHaveLength(1);
    const version = versionRows[0]!;
    expect(version.version).toBe(1);
    const parsed = productConfigSchema.safeParse({ ...(version.config as object), themeId: product.themeId });
    expect(parsed.success).toBe(true);
  });

  it("creates exactly one admin user with a credential account", async () => {
    const userRows = await db.select().from(users).where(eq(users.email, SEED_ADMIN.email));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.role).toBe("admin");

    const accountRows = await db.select().from(accounts).where(eq(accounts.providerId, "credential"));
    const seededAccounts = accountRows.filter((row) => row.userId === userRows[0]?.id);
    expect(seededAccounts).toHaveLength(1);
    expect(seededAccounts[0]?.password).toBeTruthy();
  });

  it("creates exactly one owner user with a credential account", async () => {
    const userRows = await db.select().from(users).where(eq(users.email, SEED_OWNER.email));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.role).toBe("owner");

    const accountRows = await db.select().from(accounts).where(eq(accounts.providerId, "credential"));
    const seededAccounts = accountRows.filter((row) => row.userId === userRows[0]?.id);
    expect(seededAccounts).toHaveLength(1);
    expect(seededAccounts[0]?.password).toBeTruthy();
  });

  it("creates exactly one default decision thresholds row", async () => {
    const rows = await db.select().from(decisionThresholds).where(isNull(decisionThresholds.productId));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.minVisits).toBe(1000);
    expect(row.killMaxConversion).toBe(0.02);
    expect(row.scaleMinConversion).toBe(0.05);
    expect(row.scaleRequiresPositiveMargin).toBe(true);
    expect(row.isSeed).toBe(true);
  });

  it.each([
    { slug: "descri-pro", themeSlug: "corporate", status: "learn" },
    { slug: "nom-de-marque", themeSlug: "playful", status: "test" },
  ])(
    "creates exactly one $slug product, seeded, $status, $themeSlug theme, fr",
    async ({ slug, themeSlug, status }) => {
      const rows = await db.select().from(products).where(eq(products.slug, slug));
      expect(rows).toHaveLength(1);
      const product = rows[0]!;
      expect(product.status).toBe(status);
      expect(product.isSeed).toBe(true);
      expect(product.currentVersion).toBe(1);
      expect(product.locale).toBe("fr");

      const theme = await db.query.themes.findFirst({ where: eq(themes.slug, themeSlug) });
      expect(product.themeId).toBe(theme?.id);

      const versionRows = await db.select().from(productVersions).where(eq(productVersions.productId, product.id));
      expect(versionRows).toHaveLength(1);
      const parsed = productConfigSchema.safeParse({
        ...(versionRows[0]!.config as object),
        themeId: product.themeId,
      });
      expect(parsed.success).toBe(true);
    },
  );
});

describe("credentials", () => {
  // `lib/env.ts`'s `env` singleton reads `process.env.DEMO_MODE` the first
  // time anything imports `lib/db` (t3-env's schema requires it): a bare
  // `delete` after this describe block would leave it `undefined` instead
  // of restoring the worktree's own `.env.local` value, breaking every
  // later test that touches the database. Save and restore it instead.
  const originalDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_PASSWORD;
    delete process.env.SEED_OWNER_EMAIL;
    delete process.env.SEED_OWNER_PASSWORD;
  });

  it("resolveCredentials falls back to the dev constants when no SEED_* variable is set", () => {
    const credentials = resolveCredentials();
    expect(credentials.admin.email).toBe(SEED_ADMIN.email);
    expect(credentials.owner.email).toBe(SEED_OWNER.email);
    expect(credentials.usingDevDefaults).toBe(true);
  });

  it("resolveCredentials reads SEED_ADMIN_*/SEED_OWNER_* over the dev constants", () => {
    process.env.SEED_ADMIN_EMAIL = "admin@example.test";
    process.env.SEED_ADMIN_PASSWORD = "a-strong-admin-password";
    process.env.SEED_OWNER_EMAIL = "owner@example.test";
    process.env.SEED_OWNER_PASSWORD = "a-strong-owner-password";
    const credentials = resolveCredentials();
    expect(credentials.admin.email).toBe("admin@example.test");
    expect(credentials.owner.email).toBe("owner@example.test");
    expect(credentials.usingDevDefaults).toBe(false);
  });

  it("refuses to seed when DEMO_MODE=true and the credentials are still the dev defaults", async () => {
    process.env.DEMO_MODE = "true";
    await expect(seed({ sql })).rejects.toThrow(/DEMO_MODE/);
  });

  it("does not refuse when DEMO_MODE=true and the credentials were overridden", async () => {
    process.env.DEMO_MODE = "true";
    process.env.SEED_ADMIN_EMAIL = "admin@example.test";
    process.env.SEED_ADMIN_PASSWORD = "a-strong-admin-password";
    process.env.SEED_OWNER_EMAIL = "owner@example.test";
    process.env.SEED_OWNER_PASSWORD = "a-strong-owner-password";
    await expect(seed({ sql })).resolves.toBeUndefined();

    // Cleanup: this run created a second admin/owner pair under the
    // overridden emails, which the shared worktree DB must not keep.
    const admin = await db.query.users.findFirst({ where: eq(users.email, "admin@example.test") });
    const owner = await db.query.users.findFirst({ where: eq(users.email, "owner@example.test") });
    await db.delete(accounts).where(eq(accounts.userId, admin!.id));
    await db.delete(accounts).where(eq(accounts.userId, owner!.id));
    await db.delete(users).where(eq(users.id, admin!.id));
    await db.delete(users).where(eq(users.id, owner!.id));
  });
});

// Pure (no database): the same arguments always produce the same plan.
describe("buildSeedUsage", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const pack = { id: "pack-10", credits: 10, priceCents: 490 };
  const fixtures = [
    { input: { a: "1" }, text: "hello", usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0 } },
  ];
  const model = "anthropic/claude-haiku-4.5";

  function targetFor(slug: string): ProductUsageTarget {
    const target = SEED_USAGE_TARGETS.find((candidate) => candidate.slug === slug);
    if (!target) throw new Error(`no usage target for ${slug}`);
    return target;
  }

  it("is deterministic: the same arguments produce the exact same plan", () => {
    const target = targetFor("lettre-pro");
    const first = buildSeedUsage(target, pack, fixtures, model, now);
    const second = buildSeedUsage(target, pack, fixtures, model, now);
    expect(first).toEqual(second);
  });

  it.each(SEED_USAGE_TARGETS)("$slug has at least 1000 visits", (target) => {
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    const visits = plan.events.filter((event) => event.type === "visit");
    expect(visits.length).toBeGreaterThanOrEqual(1000);
  });

  it.each(SEED_USAGE_TARGETS)("$slug's every timestamp falls inside [startOfUtcDay(now-28d), now-10min]", (target) => {
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    const { start, end } = seedUsageWindow(now);
    const timestamps = [
      ...plan.events.map((event) => event.createdAt),
      ...plan.generations.map((generation) => generation.createdAt),
      ...plan.buyers.map((buyer) => buyer.purchase.createdAt),
      ...plan.buyers.map((buyer) => buyer.purchaseEventAt),
    ];
    expect(timestamps.length).toBeGreaterThan(0);
    for (const timestamp of timestamps) {
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(end.getTime());
    }
    expect(start).toEqual(startOfUtcDay(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)));
  });

  it("lettre-pro's signup-to-purchase rate is at or above the scale threshold (5 %)", () => {
    const target = targetFor("lettre-pro");
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    const signups = plan.events.filter((event) => event.type === "signup").length;
    expect(plan.buyers.length / signups).toBeGreaterThanOrEqual(0.05);
  });

  it("nom-de-marque's signup-to-purchase rate is below the kill threshold (2 %)", () => {
    const target = targetFor("nom-de-marque");
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    const signups = plan.events.filter((event) => event.type === "signup").length;
    expect(plan.buyers.length / signups).toBeLessThan(0.02);
  });

  it("descri-pro's signup-to-purchase rate sits strictly between the kill and scale thresholds", () => {
    const target = targetFor("descri-pro");
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    const signups = plan.events.filter((event) => event.type === "signup").length;
    const rate = plan.buyers.length / signups;
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThan(0.05);
  });

  it("every id is seed-owned: anonymous ids start with seed-, idempotency keys with seed:, events carry metadata.seed", () => {
    const target = targetFor("lettre-pro");
    const plan = buildSeedUsage(target, pack, fixtures, model, now);
    for (const event of plan.events) {
      expect(event.anonymousId).toMatch(/^seed-/);
      expect(event.metadata.seed).toBe(true);
    }
    for (const generation of plan.generations) {
      expect(generation.idempotencyKey).toMatch(/^seed:/);
      expect(generation.anonymousId).toMatch(/^seed-/);
    }
    for (const buyer of plan.buyers) {
      expect(buyer.purchase.idempotencyKey).toMatch(/^seed:/);
      expect(buyer.email).toMatch(/@seed\.msb\.local$/);
    }
  });
});

// Integration: the story is asserted through the real getPortfolioMetrics
// and evaluate (orchestrator decision 4), not through raw row counts —
// the DAL functions this exercises already require the mocked admin
// session and next/cache set up above.
describe("the seeded story, through the real metrics and decision", () => {
  it.each([
    { slug: "lettre-pro", decision: "scale" },
    { slug: "descri-pro", decision: null },
    { slug: "nom-de-marque", decision: "kill" },
  ])("$slug evaluates to $decision over the last 30 days", async ({ slug, decision }) => {
    const { getPortfolioMetrics } = await import("../lib/dal/metrics");
    const { getThresholds } = await import("../lib/dal/thresholds");
    const metrics = await getPortfolioMetrics({ days: 30 });
    const product = metrics.products.find((candidate) => candidate.slug === slug);
    expect(product).toBeDefined();
    expect(product!.visits).toBeGreaterThanOrEqual(1000);

    const thresholds = await getThresholds(product!.productId);
    expect(evaluate(product!, thresholds)).toBe(decision);
  });
});
