// Business tables (docs/07-modele-de-donnees.md): the full catalogue
// (themes, products, product_versions, decision_thresholds) and usage
// (credit_transactions, balances, generations, purchases, events) blocks.
// `users` is Better Auth's table, extended with `role` (auth-schema.ts):
// that makes 10 business tables in total.
//
// No `import "server-only"` here: drizzle-kit and tsx (scripts/seed.ts,
// drizzle.config.ts) import this module directly, outside a request.
//
// Relative imports only: drizzle-kit does not resolve the `@/*` alias.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { eventTypeSchema } from "../schemas/event-type";
import { productStatusSchema } from "../schemas/product-config";
import type { ProductConfig } from "../schemas/product-config";
import { landingVariantSchema } from "../schemas/theme-tokens";
import type { ThemeTokens } from "../schemas/theme-tokens";
import { users } from "./auth-schema";

// Enums are built from the Zod schemas' `.options` (specs/CONTRACT-data
// plan › Frozen inputs) so the database and the shared Zod schemas cannot
// drift apart.
export const productStatus = pgEnum("product_status", productStatusSchema.options as [string, ...string[]]);
export const landingVariant = pgEnum("landing_variant", landingVariantSchema.options as [string, ...string[]]);
export const eventType = pgEnum("event_type", eventTypeSchema.options as [string, ...string[]]);

// Not driven by a Zod schema (docs/07 names these two enums directly, no
// shared input schema references them).
export const creditReason = pgEnum("credit_reason", ["signup_bonus", "purchase", "generation", "refund"]);
export const generationStatus = pgEnum("generation_status", ["pending", "succeeded", "failed"]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const themes = pgTable("themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tokens: jsonb("tokens").$type<ThemeTokens>().notNull(),
  landingVariant: landingVariant("landing_variant").notNull(),
  isSeed: boolean("is_seed").notNull().default(false),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

// `current_version` deliberately has no FK to `product_versions`: inserting
// a product and its first version would otherwise be a circular reference.
// The composite FK lives on `generations` instead (docs/07's invariant "Une
// génération pointe vers une config qui existe").
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    status: productStatus("status").notNull().default("test"),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id),
    currentVersion: integer("current_version").notNull(),
    locale: text("locale").notNull(),
    isSeed: boolean("is_seed").notNull().default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    statusNote: text("status_note"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("products_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("products_current_version_positive", sql`${table.currentVersion} >= 1`),
    check("products_locale_valid", sql`${table.locale} IN ('fr', 'en')`),
  ],
);

export const productVersions = pgTable(
  "product_versions",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    version: integer("version").notNull(),
    config: jsonb("config").$type<ProductConfig>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.version] }),
    check("product_versions_version_positive", sql`${table.version} >= 1`),
  ],
);

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    productVersion: integer("product_version").notNull(),
    userId: text("user_id").references(() => users.id),
    anonymousId: text("anonymous_id"),
    ipHash: text("ip_hash").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    costMicros: integer("cost_micros"),
    status: generationStatus("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "generations_product_version_fk",
      columns: [table.productId, table.productVersion],
      foreignColumns: [productVersions.productId, productVersions.version],
    }),
    index("generations_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("generations_ip_hash_created_at_idx").on(table.ipHash, table.createdAt),
    index("generations_product_id_created_at_idx").on(table.productId, table.createdAt),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    packId: text("pack_id").notNull(),
    credits: integer("credits").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    check("purchases_credits_positive", sql`${table.credits} > 0`),
    check("purchases_amount_cents_positive", sql`${table.amountCents} > 0`),
  ],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    delta: integer("delta").notNull(),
    reason: creditReason("reason").notNull(),
    generationId: uuid("generation_id").references(() => generations.id),
    purchaseId: uuid("purchase_id").references(() => purchases.id),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    check("credit_transactions_delta_nonzero", sql`${table.delta} <> 0`),
    index("credit_transactions_user_id_product_id_created_at_idx").on(table.userId, table.productId, table.createdAt),
  ],
);

export const balances = pgTable(
  "balances",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    balance: integer("balance").notNull().default(0),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.productId] }),
    check("balances_balance_nonnegative", sql`${table.balance} >= 0`),
  ],
);

export const events = pgTable(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    type: eventType("type").notNull(),
    // No FK (docs/07): anonymous events carry no user row to reference.
    userId: text("user_id"),
    anonymousId: text("anonymous_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [index("events_product_id_type_created_at_idx").on(table.productId, table.type, table.createdAt)],
);

// A row with a null `product_id` carries the studio default; a row with a
// product carries its override. `nullsNotDistinct` makes the default row
// unique too (docs/07: "il n'existe qu'un réglage par défaut").
export const decisionThresholds = pgTable(
  "decision_thresholds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id),
    minVisits: integer("min_visits"),
    killMaxConversion: numeric("kill_max_conversion", { precision: 5, scale: 4, mode: "number" }),
    scaleMinConversion: numeric("scale_min_conversion", { precision: 5, scale: 4, mode: "number" }),
    scaleRequiresPositiveMargin: boolean("scale_requires_positive_margin"),
    isSeed: boolean("is_seed").notNull().default(false),
    updatedBy: text("updated_by").references(() => users.id),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("decision_thresholds_product_id_key").on(table.productId).nullsNotDistinct(),
    check("decision_thresholds_min_visits_positive", sql`${table.minVisits} IS NULL OR ${table.minVisits} > 0`),
    check(
      "decision_thresholds_kill_max_conversion_range",
      sql`${table.killMaxConversion} IS NULL OR (${table.killMaxConversion} >= 0 AND ${table.killMaxConversion} <= 1)`,
    ),
    check(
      "decision_thresholds_scale_min_conversion_range",
      sql`${table.scaleMinConversion} IS NULL OR (${table.scaleMinConversion} >= 0 AND ${table.scaleMinConversion} <= 1)`,
    ),
    check(
      "decision_thresholds_kill_lt_scale",
      sql`${table.killMaxConversion} IS NULL OR ${table.scaleMinConversion} IS NULL OR ${table.killMaxConversion} < ${table.scaleMinConversion}`,
    ),
    check(
      "decision_thresholds_default_row_complete",
      sql`${table.productId} IS NOT NULL OR (
        ${table.minVisits} IS NOT NULL AND
        ${table.killMaxConversion} IS NOT NULL AND
        ${table.scaleMinConversion} IS NOT NULL AND
        ${table.scaleRequiresPositiveMargin} IS NOT NULL
      )`,
    ),
  ],
);
