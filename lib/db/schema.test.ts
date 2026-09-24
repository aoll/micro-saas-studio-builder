// Schema constraint tests (specs/CONTRACT-data.md, docs/07): the full data
// model's constraints and index are enforced by Postgres, not only by
// application code (docs/07 › Invariants, index et migrations). Runs
// against the worktree's real database — no mocked driver.
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
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
} from "./schema";

const slug = (label: string) => `${label}-${randomUUID()}`;

let ownerId: string;
let themeId: string;
let productId: string;

const createdProductIds: string[] = [];
const createdThemeIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  ownerId = randomUUID();
  createdUserIds.push(ownerId);
  await db
    .insert(users)
    .values({ id: ownerId, name: "Schema test owner", email: `${slug("schema-owner")}@example.test`, role: "owner" });

  themeId = randomUUID();
  createdThemeIds.push(themeId);
  await db.insert(themes).values({
    id: themeId,
    slug: slug("schema-theme"),
    name: "Schema test theme",
    tokens: {},
    landingVariant: "centered",
  });

  productId = randomUUID();
  createdProductIds.push(productId);
  await db.insert(products).values({
    id: productId,
    slug: slug("schema-product"),
    themeId,
    currentVersion: 1,
    locale: "fr",
    createdBy: ownerId,
  });
  await db.insert(productVersions).values({ productId, version: 1, config: {}, createdBy: ownerId });
});

afterAll(async () => {
  if (createdProductIds.length) {
    await db.delete(generations).where(sql`${generations.productId} IN ${createdProductIds}`);
    await db.delete(productVersions).where(sql`${productVersions.productId} IN ${createdProductIds}`);
    await db.delete(products).where(sql`${products.id} IN ${createdProductIds}`);
  }
  if (createdThemeIds.length) await db.delete(themes).where(sql`${themes.id} IN ${createdThemeIds}`);
  if (createdUserIds.length) await db.delete(users).where(sql`${users.id} IN ${createdUserIds}`);
});

describe("indexes", () => {
  it("has the 5 docs/07 indexes", async () => {
    const rows = await db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public'`,
    );
    const names = rows.map((row) => row.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "generations_user_id_created_at_idx",
        "generations_ip_hash_created_at_idx",
        "generations_product_id_created_at_idx",
        "events_product_id_type_created_at_idx",
        "credit_transactions_user_id_product_id_created_at_idx",
      ]),
    );
  });
});

describe("balances.balance CHECK (>= 0)", () => {
  it("rejects a negative balance", async () => {
    await expect(db.insert(balances).values({ userId: ownerId, productId, balance: -1 })).rejects.toThrow(/violates/);
  });

  it("accepts a zero balance", async () => {
    await db.insert(balances).values({ userId: ownerId, productId, balance: 0 });
    await db.delete(balances).where(sql`${balances.userId} = ${ownerId} AND ${balances.productId} = ${productId}`);
  });
});

describe("credit_transactions.delta CHECK (<> 0)", () => {
  it("rejects a zero delta", async () => {
    await expect(
      db.insert(creditTransactions).values({
        userId: ownerId,
        productId,
        delta: 0,
        reason: "signup_bonus",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects a duplicate idempotency_key", async () => {
    const idempotencyKey = randomUUID();
    await db
      .insert(creditTransactions)
      .values({ userId: ownerId, productId, delta: 3, reason: "signup_bonus", idempotencyKey });
    await expect(
      db
        .insert(creditTransactions)
        .values({ userId: ownerId, productId, delta: 3, reason: "signup_bonus", idempotencyKey }),
    ).rejects.toThrow(/violates/);
  });
});

describe("generations composite FK (product_id, product_version)", () => {
  it("rejects a generation pointing at a version that does not exist", async () => {
    await expect(
      db.insert(generations).values({
        productId,
        productVersion: 99,
        ipHash: "hash",
        input: {},
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects a duplicate idempotency_key", async () => {
    const idempotencyKey = randomUUID();
    await db.insert(generations).values({ productId, productVersion: 1, ipHash: "hash", input: {}, idempotencyKey });
    await expect(
      db.insert(generations).values({ productId, productVersion: 1, ipHash: "hash", input: {}, idempotencyKey }),
    ).rejects.toThrow(/violates/);
  });
});

describe("purchases", () => {
  it("rejects credits = 0", async () => {
    await expect(
      db.insert(purchases).values({
        userId: ownerId,
        productId,
        packId: "pack-10",
        credits: 0,
        amountCents: 490,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects amount_cents = 0", async () => {
    await expect(
      db.insert(purchases).values({
        userId: ownerId,
        productId,
        packId: "pack-10",
        credits: 10,
        amountCents: 0,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects a duplicate idempotency_key", async () => {
    const idempotencyKey = randomUUID();
    await db
      .insert(purchases)
      .values({ userId: ownerId, productId, packId: "pack-10", credits: 10, amountCents: 490, idempotencyKey });
    await expect(
      db
        .insert(purchases)
        .values({ userId: ownerId, productId, packId: "pack-10", credits: 10, amountCents: 490, idempotencyKey }),
    ).rejects.toThrow(/violates/);
  });
});

describe("decision_thresholds", () => {
  it("rejects a second default row (product_id null, nullsNotDistinct)", async () => {
    await db.insert(decisionThresholds).values({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
    });
    await expect(
      db.insert(decisionThresholds).values({
        minVisits: 1000,
        killMaxConversion: 0.01,
        scaleMinConversion: 0.05,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects kill_max_conversion >= scale_min_conversion", async () => {
    await expect(
      db.insert(decisionThresholds).values({
        productId,
        killMaxConversion: 0.05,
        scaleMinConversion: 0.05,
        minVisits: 1000,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects a conversion above 1", async () => {
    await expect(
      db.insert(decisionThresholds).values({
        productId,
        killMaxConversion: 1.5,
        scaleMinConversion: 2,
        minVisits: 1000,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects min_visits = 0", async () => {
    await expect(
      db.insert(decisionThresholds).values({
        productId,
        minVisits: 0,
        killMaxConversion: 0.02,
        scaleMinConversion: 0.05,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects a default row (product_id null) with a null column", async () => {
    await expect(
      db.insert(decisionThresholds).values({
        minVisits: 1000,
        killMaxConversion: 0.02,
        scaleMinConversion: null,
        scaleRequiresPositiveMargin: true,
      }),
    ).rejects.toThrow(/violates/);
  });

  it("accepts a per-product override with a single non-null column", async () => {
    const [row] = await db
      .insert(decisionThresholds)
      .values({ productId, killMaxConversion: 0.01 })
      .returning({ id: decisionThresholds.id });
    await db.delete(decisionThresholds).where(sql`${decisionThresholds.id} = ${row!.id}`);
  });
});

describe("products", () => {
  it("rejects a slug with spaces or uppercase letters", async () => {
    await expect(
      db.insert(products).values({ slug: "Bad Slug", themeId, currentVersion: 1, locale: "fr", createdBy: ownerId }),
    ).rejects.toThrow(/violates/);
  });

  it("rejects an unknown locale", async () => {
    await expect(
      db
        .insert(products)
        .values({ slug: slug("bad-locale"), themeId, currentVersion: 1, locale: "de", createdBy: ownerId }),
    ).rejects.toThrow(/violates/);
  });
});

describe("events", () => {
  it("uses an identity id and accepts a nullable user_id", async () => {
    const [row] = await db
      .insert(events)
      .values({ productId, type: "visit", anonymousId: randomUUID() })
      .returning({ id: events.id });
    expect(row?.id).toBeGreaterThan(0);
    await db.delete(events).where(sql`${events.id} = ${row!.id}`);
  });
});
