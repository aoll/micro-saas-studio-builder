// specs/DEMO-mode.md (orchestrator decision 6): resetDemo deletes real
// data, so this file runs ONLY against an isolated, throwaway database —
// created, migrated and seeded here, then dropped in afterAll. It never
// touches the shared worktree database (the one every other test file in
// this repo reads DATABASE_URL for). Mirrors the CREATE/DROP DATABASE
// pattern of scripts/worktree-db.ts.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accounts, users } from "../lib/db/auth-schema";
import {
  balances,
  creditTransactions,
  decisionThresholds,
  events,
  generations,
  productVersions,
  products,
  purchases,
  themes,
} from "../lib/db/schema";
import type { ProductConfig } from "../lib/schemas/product-config";
import { SEED_ADMIN, SEED_OWNER, seed } from "./seed";
import { resetDemo } from "./reset-demo";

const ADMIN_URL = process.env.POSTGRES_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const DB_NAME = `msb_reset_demo_test_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

function dbUrlFor(name: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

const DB_URL = dbUrlFor(DB_NAME);

let sql: postgres.Sql;
const db = () =>
  drizzle(sql, {
    schema: {
      products,
      productVersions,
      themes,
      decisionThresholds,
      users,
      accounts,
      events,
      generations,
      purchases,
      creditTransactions,
      balances,
    },
  });

async function withAdminDb<T>(fn: (adminSql: postgres.Sql) => Promise<T>): Promise<T> {
  const adminSql = postgres(ADMIN_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    return await fn(adminSql);
  } finally {
    await adminSql.end({ timeout: 5 });
  }
}

beforeAll(async () => {
  await withAdminDb(async (adminSql) => {
    await adminSql.unsafe(`CREATE DATABASE "${DB_NAME}"`);
  });

  // Same pattern as scripts/worktree-db.ts's `ensure()`: DATABASE_URL is
  // already set in this child's env before drizzle.config.ts's
  // loadEnvConfig runs, so .env.local never overrides it.
  execFileSync("pnpm", ["db:migrate"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: DB_URL },
  });

  sql = postgres(DB_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  await seed({ sql });
}, 120_000);

afterAll(async () => {
  await sql.end({ timeout: 5 });
  await withAdminDb(async (adminSql) => {
    await adminSql.unsafe(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  });
}, 30_000);

function visitorConfig(slug: string, themeId: string): ProductConfig {
  return {
    slug,
    name: "Visitor product",
    status: "test",
    themeId,
    locale: "fr",
    branding: {},
    landing: { headline: "H", subheadline: "S", faq: [], seoTitle: "T", seoDescription: "D" },
    inputs: [{ key: "topic", label: "Topic", type: "text", required: true }],
    generation: { model: "anthropic/claude-haiku-4.5", promptTemplate: "About {{topic}}", outputType: "markdown" },
    pricing: {
      freeCreditsOnSignup: 3,
      anonymousFreeGenerations: 1,
      costPerGeneration: 1,
      packs: [{ id: "pack-10", credits: 10, priceCents: 490 }],
    },
  };
}

/** Pollutes the freshly seeded database with a visitor-created product and visitor activity mixed onto a seeded product, exactly the mess resetDemo exists to clean up. */
async function pollute(): Promise<{ visitorProductId: string; lettreProId: string; visitorUserId: string }> {
  const database = db();
  const editorial = await database.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
  const owner = await database.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const lettrePro = await database.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });

  const config = visitorConfig(`visitor-product-${randomUUID()}`, editorial!.id);
  const [visitorProduct] = await database
    .insert(products)
    .values({
      slug: config.slug,
      status: config.status,
      themeId: editorial!.id,
      currentVersion: 1,
      locale: config.locale,
      isSeed: false,
      createdBy: owner!.id,
    })
    .returning({ id: products.id });
  await database
    .insert(productVersions)
    .values({ productId: visitorProduct!.id, version: 1, config, createdBy: owner!.id });
  await database.insert(decisionThresholds).values({ productId: visitorProduct!.id, minVisits: 500 });

  const visitorUserId = randomUUID();
  await database
    .insert(users)
    .values({ id: visitorUserId, name: "A visitor", email: `visitor-${randomUUID()}@example.test`, role: "user" });

  // Visitor activity on their own new product.
  await database.insert(events).values({ productId: visitorProduct!.id, type: "visit", anonymousId: "real-visitor" });
  await database.insert(generations).values({
    productId: visitorProduct!.id,
    productVersion: 1,
    userId: null,
    anonymousId: "real-visitor",
    ipHash: "real-ip",
    input: { topic: "x" },
    status: "succeeded",
    idempotencyKey: `real:${randomUUID()}`,
  });

  // Visitor activity mixed onto the *seeded* LettrePro product — the case
  // a partial ("only delete non-seed products") reset would miss.
  await database.insert(purchases).values({
    userId: visitorUserId,
    productId: lettrePro!.id,
    packId: "pack-10",
    credits: 10,
    amountCents: 490,
    idempotencyKey: `real:${randomUUID()}`,
  });
  await database.insert(creditTransactions).values({
    userId: visitorUserId,
    productId: lettrePro!.id,
    delta: 10,
    reason: "purchase",
    idempotencyKey: `real:${randomUUID()}`,
  });
  await database.insert(balances).values({ userId: visitorUserId, productId: lettrePro!.id, balance: 10 });

  return { visitorProductId: visitorProduct!.id, lettreProId: lettrePro!.id, visitorUserId };
}

describe("resetDemo", () => {
  it("wipes visitor products, visitor activity on seeded products, and visitor accounts; replays the seeded story", async () => {
    const { visitorProductId, lettreProId, visitorUserId } = await pollute();

    await resetDemo({ sql });

    const database = db();

    const visitorProduct = await database.query.products.findFirst({ where: eq(products.id, visitorProductId) });
    expect(visitorProduct).toBeUndefined();
    const visitorVersions = await database
      .select()
      .from(productVersions)
      .where(eq(productVersions.productId, visitorProductId));
    expect(visitorVersions).toHaveLength(0);
    const visitorThresholds = await database
      .select()
      .from(decisionThresholds)
      .where(eq(decisionThresholds.productId, visitorProductId));
    expect(visitorThresholds).toHaveLength(0);

    const visitorUser = await database.query.users.findFirst({ where: eq(users.id, visitorUserId) });
    expect(visitorUser).toBeUndefined();

    const realCreditTransactions = await database
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, `real:${visitorUserId}`));
    expect(realCreditTransactions).toHaveLength(0);

    const lettreProBalances = await database.select().from(balances).where(eq(balances.productId, lettreProId));
    expect(lettreProBalances.every((row) => row.userId !== visitorUserId)).toBe(true);

    // The 3 seeded products survive, unchanged in slug/theme/status.
    const lettrePro = await database.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    expect(lettrePro?.isSeed).toBe(true);
    expect(lettrePro?.status).toBe("scale");
    const descriPro = await database.query.products.findFirst({ where: eq(products.slug, "descri-pro") });
    expect(descriPro?.isSeed).toBe(true);
    const nomDeMarque = await database.query.products.findFirst({ where: eq(products.slug, "nom-de-marque") });
    expect(nomDeMarque?.isSeed).toBe(true);

    // Admin and owner survive (only role="user" is wiped).
    const admin = await database.query.users.findFirst({ where: eq(users.email, SEED_ADMIN.email) });
    expect(admin).toBeDefined();
    const owner = await database.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
    expect(owner).toBeDefined();

    // Fresh, canonical seed usage replaces the polluted one exactly: the
    // deterministic generator's own count for lettre-pro (docs/07 the
    // reset "rejoue le seed"), not the count inflated by pollute()'s
    // extra generation row (which lived on the visitor product, already
    // gone, so this also confirms no cross-product leftovers).
    const lettreProGenerations = await database
      .select()
      .from(generations)
      .where(eq(generations.productId, lettreProId));
    expect(lettreProGenerations).toHaveLength(80);
  }, 60_000);

  it("is idempotent: running it twice in a row leaves the same story", async () => {
    await resetDemo({ sql });
    const database = db();
    const lettreProGenerationsFirst = await database
      .select({ id: generations.id })
      .from(generations)
      .innerJoin(products, eq(products.id, generations.productId))
      .where(eq(products.slug, "lettre-pro"));

    await resetDemo({ sql });
    const lettreProGenerationsSecond = await database
      .select({ id: generations.id })
      .from(generations)
      .innerJoin(products, eq(products.id, generations.productId))
      .where(eq(products.slug, "lettre-pro"));

    expect(lettreProGenerationsSecond).toHaveLength(lettreProGenerationsFirst.length);
  }, 60_000);
});
