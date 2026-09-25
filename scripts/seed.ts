// Idempotent local seed (specs/CONTRACT-data.md, specs/DEMO-mode.md): the 4
// dossier themes (docs/01-produit.md › Thèmes seedés pour la démo), the 3
// locked products that tell the scale / hesitate / kill story
// (docs/01 › Contenu des produits seedés), the admin and owner accounts,
// the studio's default decision thresholds (docs/07-modele-de-donnees.md),
// and 30 days of usage that makes the story readable through the real
// metrics (lib/dal/metrics.ts, lib/decision.ts). This script never imports
// `lib/db/index.ts` (`import "server-only"`) or `lib/env.ts` (which
// requires all 8 variables): it builds its own client from `DATABASE_URL`
// alone, like scripts/worktree-db.ts.
//
// Usage: pnpm tsx scripts/seed.ts (wired to `pnpm db:seed`)
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Namespace import: see the comment in drizzle.config.ts.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
import { requireDatabaseUrl } from "../lib/require-database-url";
import { productConfigSchema, type ProductConfig } from "../lib/schemas/product-config";
import type { EventType } from "../lib/schemas/event-type";
import type { LandingVariant } from "../lib/schemas/theme-tokens";
import type { ThemeTokens } from "../lib/schemas/theme-tokens";

loadEnvConfig(process.cwd());

// Dev-only fallback (docs/01 › Mode démo public: "envoyés avec la
// candidature, pas affichés dans l'app"). `resolveCredentials` (below)
// reads `SEED_ADMIN_*`/`SEED_OWNER_*` from the environment first and
// refuses to seed a public demo on these defaults (orchestrator decision 5).
const DEV_ADMIN = { email: "admin@msb.local", password: "dev-admin-password-msb" };
const DEV_OWNER = { email: "owner@msb.local", password: "dev-owner-password-msb" };

type Credential = { email: string; password: string };
export type SeedCredentials = { admin: Credential; owner: Credential; usingDevDefaults: boolean };

function readCredential(prefix: "ADMIN" | "OWNER", fallback: Credential): Credential {
  return {
    email: process.env[`SEED_${prefix}_EMAIL`] ?? fallback.email,
    password: process.env[`SEED_${prefix}_PASSWORD`] ?? fallback.password,
  };
}

// Read fresh from `process.env` at call time (not cached at module load),
// so a test can flip `DEMO_MODE` or the `SEED_*` variables without
// re-importing the module.
export function resolveCredentials(): SeedCredentials {
  const admin = readCredential("ADMIN", DEV_ADMIN);
  const owner = readCredential("OWNER", DEV_OWNER);
  const usingDevDefaults =
    admin.email === DEV_ADMIN.email &&
    admin.password === DEV_ADMIN.password &&
    owner.email === DEV_OWNER.email &&
    owner.password === DEV_OWNER.password;
  return { admin, owner, usingDevDefaults };
}

// Snapshot at module load, for callers that only need to look a seeded
// account up by email (e.g. lib/dal/guards.test.ts's SEED_OWNER) — equal
// to the dev defaults whenever no `SEED_*` variable is set, exactly as
// before this file read the environment at all.
export const SEED_ADMIN: Credential = readCredential("ADMIN", DEV_ADMIN);
export const SEED_OWNER: Credential = readCredential("OWNER", DEV_OWNER);

type SeedTheme = { slug: string; name: string; landingVariant: LandingVariant; tokens: ThemeTokens };

// docs/01-produit.md › Thèmes seedés pour la démo; font keys shared with
// CONTRACT-ui's lib/fonts.ts catalogue (orchestrator decision 4): `serif`,
// `grotesk`, `sans`, `rounded`.
const SEED_THEMES: SeedTheme[] = [
  {
    slug: "editorial",
    name: "Editorial",
    landingVariant: "centered",
    tokens: {
      light: {
        background: "#faf7f2",
        foreground: "#2b2620",
        card: "#ffffff",
        cardForeground: "#2b2620",
        primary: "#8a5a34",
        primaryForeground: "#ffffff",
        secondary: "#efe7da",
        secondaryForeground: "#2b2620",
        muted: "#efe7da",
        mutedForeground: "#6b6357",
        accent: "#cbb994",
        accentForeground: "#2b2620",
        destructive: "#b3261e",
        border: "#e2d9c8",
        input: "#e2d9c8",
        ring: "#8a5a34",
      },
      dark: {
        background: "#201c17",
        foreground: "#f3ede0",
        card: "#2b241d",
        cardForeground: "#f3ede0",
        primary: "#c9a06a",
        primaryForeground: "#201c17",
        secondary: "#3a322a",
        secondaryForeground: "#f3ede0",
        muted: "#3a322a",
        mutedForeground: "#b8ad9b",
        accent: "#4c4132",
        accentForeground: "#f3ede0",
        destructive: "#ff6b60",
        border: "#4c4132",
        input: "#4c4132",
        ring: "#c9a06a",
      },
      fontKey: "serif",
      radius: "0.25rem",
    },
  },
  {
    slug: "neon",
    name: "Neon",
    landingVariant: "split",
    tokens: {
      light: {
        background: "#f5f3ff",
        foreground: "#17021f",
        card: "#ffffff",
        cardForeground: "#17021f",
        primary: "#ff2fb0",
        primaryForeground: "#ffffff",
        secondary: "#e6defe",
        secondaryForeground: "#17021f",
        muted: "#e6defe",
        mutedForeground: "#5c4b73",
        accent: "#7c3aed",
        accentForeground: "#ffffff",
        destructive: "#ff3b3b",
        border: "#d8cdfa",
        input: "#d8cdfa",
        ring: "#ff2fb0",
      },
      dark: {
        background: "#0b0014",
        foreground: "#f5e9ff",
        card: "#170225",
        cardForeground: "#f5e9ff",
        primary: "#ff2fb0",
        primaryForeground: "#0b0014",
        secondary: "#29063f",
        secondaryForeground: "#f5e9ff",
        muted: "#29063f",
        mutedForeground: "#c9a6e6",
        accent: "#7c3aed",
        accentForeground: "#ffffff",
        destructive: "#ff5f5f",
        border: "#3a0a55",
        input: "#3a0a55",
        ring: "#ff2fb0",
      },
      fontKey: "grotesk",
      radius: "1rem",
    },
  },
  {
    slug: "corporate",
    name: "Corporate",
    landingVariant: "minimal",
    tokens: {
      light: {
        background: "#f7f9fc",
        foreground: "#10192b",
        card: "#ffffff",
        cardForeground: "#10192b",
        primary: "#1d4ed8",
        primaryForeground: "#ffffff",
        secondary: "#e6ecf7",
        secondaryForeground: "#10192b",
        muted: "#e6ecf7",
        mutedForeground: "#56637a",
        accent: "#93c5fd",
        accentForeground: "#10192b",
        destructive: "#dc2626",
        border: "#d6e0f0",
        input: "#d6e0f0",
        ring: "#1d4ed8",
      },
      dark: {
        background: "#0b1220",
        foreground: "#e7edf7",
        card: "#111a2b",
        cardForeground: "#e7edf7",
        primary: "#3b82f6",
        primaryForeground: "#0b1220",
        secondary: "#1c2740",
        secondaryForeground: "#e7edf7",
        muted: "#1c2740",
        mutedForeground: "#94a3c4",
        accent: "#1d4ed8",
        accentForeground: "#ffffff",
        destructive: "#f87171",
        border: "#223055",
        input: "#223055",
        ring: "#3b82f6",
      },
      fontKey: "sans",
      radius: "0.375rem",
    },
  },
  {
    slug: "playful",
    name: "Playful",
    landingVariant: "centered",
    tokens: {
      light: {
        background: "#fff7fb",
        foreground: "#3a1f33",
        card: "#ffffff",
        cardForeground: "#3a1f33",
        primary: "#ff8fb1",
        primaryForeground: "#3a1f33",
        secondary: "#ffe3ee",
        secondaryForeground: "#3a1f33",
        muted: "#ffe3ee",
        mutedForeground: "#8a5f78",
        accent: "#b7f0d0",
        accentForeground: "#3a1f33",
        destructive: "#ef4444",
        border: "#ffd3e4",
        input: "#ffd3e4",
        ring: "#ff8fb1",
      },
      dark: {
        background: "#2b1421",
        foreground: "#ffe9f2",
        card: "#38182a",
        cardForeground: "#ffe9f2",
        primary: "#ff8fb1",
        primaryForeground: "#2b1421",
        secondary: "#4a1f37",
        secondaryForeground: "#ffe9f2",
        muted: "#4a1f37",
        mutedForeground: "#d7a8c1",
        accent: "#7fd6a6",
        accentForeground: "#2b1421",
        destructive: "#ff8080",
        border: "#5c2745",
        input: "#5c2745",
        ring: "#ff8fb1",
      },
      fontKey: "rounded",
      radius: "1.5rem",
    },
  },
];

const fixturesDir = new URL("../fixtures/", import.meta.url);

function readConfigFixture(slug: string): unknown {
  return JSON.parse(readFileSync(new URL(`${slug}.config.json`, fixturesDir), "utf8"));
}

type GenerationFixture = {
  input: Record<string, string>;
  text: string;
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
};

function readGenerationFixtures(slug: string): GenerationFixture[] {
  return JSON.parse(readFileSync(new URL(`${slug}.json`, fixturesDir), "utf8")) as GenerationFixture[];
}

// The 3 locked products that tell the story (docs/01 › Contenu des
// produits seedés): LettrePro scales, DescriPro hesitates (no badge),
// NomDeMarque gets flagged to cut. BioInsta stays a fixture-only config,
// created live during the demo script (fixtures/fixtures.test.ts).
const SEED_PRODUCTS: { slug: string; themeSlug: string }[] = [
  { slug: "lettre-pro", themeSlug: "editorial" },
  { slug: "descri-pro", themeSlug: "corporate" },
  { slug: "nom-de-marque", themeSlug: "playful" },
];

// --- Deterministic usage generator (orchestrator decision 4) ---------

// A tiny seeded PRNG (mulberry32): deterministic per call, no external
// dependency, good enough for spreading seed timestamps — never used for
// anything security-sensitive.
function hashSeed(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const USAGE_WINDOW_DAYS = 28;
const USAGE_WINDOW_END_BUFFER_MS = 10 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// docs/07's funnel courbes read the last 30 UTC days; this keeps every
// seeded timestamp comfortably inside that range (28 days back) and never
// later than "now" (a 10-minute buffer, orchestrator decision 4).
export function seedUsageWindow(now: Date): { start: Date; end: Date } {
  const start = startOfUtcDay(new Date(now.getTime() - USAGE_WINDOW_DAYS * DAY_MS));
  const end = new Date(now.getTime() - USAGE_WINDOW_END_BUFFER_MS);
  return { start, end };
}

function randomTimestamp(rng: () => number, start: Date, end: Date): Date {
  const span = Math.max(0, end.getTime() - start.getTime());
  return new Date(start.getTime() + Math.floor(rng() * span));
}

export type ProductUsageTarget = {
  slug: string;
  visits: number;
  firstGenerations: number;
  signups: number;
  creditsExhausted: number;
  buyers: number;
  generationsCount: number;
  packId: string;
};

// The target story (orchestrator decision 4, checked through the real
// getPortfolioMetrics/evaluate in scripts/seed.test.ts):
// - every product: >= 1000 visits;
// - LettrePro: rate 12/120 = 10 % >= scale_min_conversion (5 %) -> scale
//   (margin is positive too: a credit sells for far more than its AI cost);
// - NomDeMarque: rate 1/110 ≈ 0.9 % < kill_max_conversion (2 %) -> kill;
// - DescriPro: rate 3/100 = 3 %, between 2 % and 5 % -> no badge.
export const SEED_USAGE_TARGETS: ProductUsageTarget[] = [
  {
    slug: "lettre-pro",
    visits: 1200,
    firstGenerations: 300,
    signups: 120,
    creditsExhausted: 40,
    buyers: 12,
    generationsCount: 80,
    packId: "pack-10",
  },
  {
    slug: "descri-pro",
    visits: 1050,
    firstGenerations: 220,
    signups: 100,
    creditsExhausted: 20,
    buyers: 3,
    generationsCount: 40,
    packId: "pack-10",
  },
  {
    slug: "nom-de-marque",
    visits: 1100,
    firstGenerations: 200,
    signups: 110,
    creditsExhausted: 15,
    buyers: 1,
    generationsCount: 30,
    packId: "pack-10",
  },
];

export type SeedEvent = {
  type: EventType;
  anonymousId: string | null;
  userId: null;
  createdAt: Date;
  metadata: { seed: true } & Record<string, string | boolean>;
};

export type SeedGeneration = {
  idempotencyKey: string;
  anonymousId: string;
  ipHash: string;
  input: Record<string, string>;
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costMicros: number;
  createdAt: Date;
};

export type SeedBuyer = {
  email: string;
  purchase: { packId: string; credits: number; amountCents: number; idempotencyKey: string; createdAt: Date };
  purchaseEventAt: Date;
};

export type SeedUsagePlan = { events: SeedEvent[]; generations: SeedGeneration[]; buyers: SeedBuyer[] };

// Haiku 4.5 pricing (docs/05-ia.md, Sep 23, 2026): $1 / $5 per million
// input / output tokens, i.e. 1 / 5 micros of a dollar per token.
const INPUT_MICROS_PER_TOKEN = 1;
const OUTPUT_MICROS_PER_TOKEN = 5;

// Pure and deterministic (orchestrator decision 4): the same arguments
// always produce the exact same plan (dates included, `now` is the only
// input that varies), so scripts/seed.test.ts can assert on it without a
// database. All ids are seed-owned by convention: anonymous ids start with
// `seed-`, idempotency keys with `seed:`, every event carries
// `metadata.seed: true` — scripts/seed.ts's deleteSeedOwnedUsage matches
// exactly these.
export function buildSeedUsage(
  target: ProductUsageTarget,
  pack: { id: string; credits: number; priceCents: number },
  fixtures: GenerationFixture[],
  model: string,
  now: Date,
): SeedUsagePlan {
  const rng = mulberry32(hashSeed(target.slug));
  const { start, end } = seedUsageWindow(now);
  const at = () => randomTimestamp(rng, start, end);

  const events: SeedEvent[] = [];
  const pushEvents = (type: EventType, count: number, label: string) => {
    for (let index = 0; index < count; index++) {
      events.push({
        type,
        anonymousId: `seed-${target.slug}-${label}-${index}`,
        userId: null,
        createdAt: at(),
        metadata: { seed: true },
      });
    }
  };
  pushEvents("visit", target.visits, "visit");
  pushEvents("first_generation", target.firstGenerations, "first");
  pushEvents("signup", target.signups, "signup");
  pushEvents("credits_exhausted", target.creditsExhausted, "exhausted");

  const generations: SeedGeneration[] = [];
  for (let index = 0; index < target.generationsCount; index++) {
    const fixture = fixtures[index % fixtures.length]!;
    generations.push({
      idempotencyKey: `seed:generation:${target.slug}:${index}`,
      anonymousId: `seed-${target.slug}-gen-${index}`,
      ipHash: `seed-ip-${target.slug}-${index}`,
      input: fixture.input,
      output: fixture.text,
      model,
      inputTokens: fixture.usage.inputTokens,
      outputTokens: fixture.usage.outputTokens,
      cachedInputTokens: fixture.usage.cachedInputTokens,
      costMicros:
        fixture.usage.inputTokens * INPUT_MICROS_PER_TOKEN + fixture.usage.outputTokens * OUTPUT_MICROS_PER_TOKEN,
      createdAt: at(),
    });
  }

  const buyers: SeedBuyer[] = [];
  for (let index = 0; index < target.buyers; index++) {
    const purchaseAt = at();
    buyers.push({
      email: `seed-buyer-${target.slug}-${index}@seed.msb.local`,
      purchase: {
        packId: pack.id,
        credits: pack.credits,
        amountCents: pack.priceCents,
        idempotencyKey: `seed:purchase:${target.slug}:${index}`,
        createdAt: purchaseAt,
      },
      purchaseEventAt: purchaseAt,
    });
  }

  return { events, generations, buyers };
}

// --- Database wiring ---------------------------------------------------

// Exported so scripts/reset-demo.ts shares the exact same drizzle instance
// shape (schema keys) when it calls applySeed(tx, now) at the end of a
// reset: a `tx` built from a differently-scoped schema would be missing
// `tx.query.themes` and `tx.insert(accounts)`, both used inside applySeed.
export const createSeedDb = (sqlClient: postgres.Sql) =>
  drizzle(sqlClient, {
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

type SeedDb = ReturnType<typeof createSeedDb>;
export type SeedTx = Parameters<Parameters<SeedDb["transaction"]>[0]>[0];

async function seedCredentialUser(
  tx: SeedTx,
  credential: Credential,
  name: string,
  role: "admin" | "owner",
): Promise<string> {
  const existing = await tx.query.users.findFirst({ where: eq(users.email, credential.email) });
  if (existing) return existing.id;
  const id = randomUUID();
  await tx.insert(users).values({ id, name, email: credential.email, emailVerified: true, role });
  await tx.insert(accounts).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(credential.password),
  });
  return id;
}

async function upsertSeedThemes(tx: SeedTx): Promise<Record<string, string>> {
  const themeIdBySlug: Record<string, string> = {};
  for (const theme of SEED_THEMES) {
    const [row] = await tx
      .insert(themes)
      .values({
        slug: theme.slug,
        name: theme.name,
        tokens: theme.tokens,
        landingVariant: theme.landingVariant,
        isSeed: true,
      })
      .onConflictDoUpdate({
        target: themes.slug,
        set: {
          name: theme.name,
          tokens: theme.tokens,
          landingVariant: theme.landingVariant,
          isSeed: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: themes.id });
    themeIdBySlug[theme.slug] = row!.id;
  }
  return themeIdBySlug;
}

async function upsertSeedProduct(
  tx: SeedTx,
  slug: string,
  themeId: string,
  ownerId: string,
): Promise<{ id: string; config: ProductConfig }> {
  const rawConfig = readConfigFixture(slug) as object;
  const config = productConfigSchema.parse({ ...rawConfig, themeId });

  await tx
    .insert(products)
    .values({
      slug: config.slug,
      status: config.status,
      themeId,
      currentVersion: 1,
      locale: config.locale,
      isSeed: true,
      createdBy: ownerId,
    })
    .onConflictDoUpdate({
      target: products.slug,
      set: { status: config.status, themeId, locale: config.locale, isSeed: true, updatedAt: new Date() },
    });
  const product = await tx.query.products.findFirst({ where: eq(products.slug, slug) });

  await tx
    .insert(productVersions)
    .values({ productId: product!.id, version: 1, config, createdBy: ownerId })
    .onConflictDoNothing({ target: [productVersions.productId, productVersions.version] });

  return { id: product!.id, config };
}

// Deletes only seed-owned usage rows, in FK-safe order, by the 3
// conventions buildSeedUsage's ids follow: an idempotency key prefixed
// `seed:`, an anonymous id prefixed `seed-`, or `metadata.seed === true`.
// Exported so scripts/reset-demo.ts can reuse it (it wipes the same rows,
// plus every visitor-created row) instead of duplicating the predicates.
export async function deleteSeedOwnedUsage(tx: SeedTx): Promise<void> {
  await tx.delete(creditTransactions).where(like(creditTransactions.idempotencyKey, "seed:%"));
  await tx.delete(purchases).where(like(purchases.idempotencyKey, "seed:%"));
  await tx.delete(generations).where(like(generations.idempotencyKey, "seed:%"));

  const seedUsers = await tx.select({ id: users.id }).from(users).where(like(users.email, "%@seed.msb.local"));
  const seedUserIds = seedUsers.map((row) => row.id);
  if (seedUserIds.length > 0) {
    await tx.delete(balances).where(inArray(balances.userId, seedUserIds));
  }

  await tx.delete(events).where(or(like(events.anonymousId, "seed-%"), sql`(${events.metadata} ->> 'seed') = 'true'`));

  if (seedUserIds.length > 0) {
    await tx.delete(users).where(inArray(users.id, seedUserIds));
  }
}

async function insertSeedUsage(tx: SeedTx, productId: string, slug: string, plan: SeedUsagePlan): Promise<void> {
  if (plan.events.length > 0) {
    await tx.insert(events).values(
      plan.events.map((event) => ({
        productId,
        type: event.type,
        userId: event.userId,
        anonymousId: event.anonymousId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
    );
  }

  if (plan.generations.length > 0) {
    await tx.insert(generations).values(
      plan.generations.map((generation) => ({
        productId,
        productVersion: 1,
        userId: null,
        anonymousId: generation.anonymousId,
        ipHash: generation.ipHash,
        input: generation.input,
        output: generation.output,
        model: generation.model,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        cachedInputTokens: generation.cachedInputTokens,
        costMicros: generation.costMicros,
        status: "succeeded" as const,
        idempotencyKey: generation.idempotencyKey,
        createdAt: generation.createdAt,
      })),
    );
  }

  for (const buyer of plan.buyers) {
    const buyerId = randomUUID();
    await tx.insert(users).values({
      id: buyerId,
      name: `Seed buyer (${slug})`,
      email: buyer.email,
      emailVerified: true,
      role: "user",
    });
    const [purchaseRow] = await tx
      .insert(purchases)
      .values({
        userId: buyerId,
        productId,
        packId: buyer.purchase.packId,
        credits: buyer.purchase.credits,
        amountCents: buyer.purchase.amountCents,
        idempotencyKey: buyer.purchase.idempotencyKey,
        createdAt: buyer.purchase.createdAt,
      })
      .returning({ id: purchases.id });
    await tx.insert(creditTransactions).values({
      userId: buyerId,
      productId,
      delta: buyer.purchase.credits,
      reason: "purchase",
      purchaseId: purchaseRow!.id,
      idempotencyKey: `seed:credit:${buyer.purchase.idempotencyKey}`,
      createdAt: buyer.purchase.createdAt,
    });
    await tx.insert(balances).values({
      userId: buyerId,
      productId,
      balance: buyer.purchase.credits,
      updatedAt: buyer.purchase.createdAt,
    });
    await tx.insert(events).values({
      productId,
      type: "purchase",
      userId: buyerId,
      anonymousId: null,
      metadata: { seed: true, packId: buyer.purchase.packId },
      createdAt: buyer.purchaseEventAt,
    });
  }
}

// The catalogue (themes, the 3 locked products, thresholds, admin/owner
// accounts) plus 30 days of usage that tells the story, replaced on every
// run (orchestrator decision 4: "Usage is replaced in one transaction").
export async function applySeed(tx: SeedTx, now: Date): Promise<void> {
  const themeIdBySlug = await upsertSeedThemes(tx);

  const credentials = resolveCredentials();
  await seedCredentialUser(tx, credentials.admin, "Admin", "admin");
  const ownerId = await seedCredentialUser(tx, credentials.owner, "Owner", "owner");

  await tx
    .insert(decisionThresholds)
    .values({
      minVisits: 1000,
      killMaxConversion: 0.02,
      scaleMinConversion: 0.05,
      scaleRequiresPositiveMargin: true,
      isSeed: true,
    })
    .onConflictDoNothing({ target: decisionThresholds.productId });

  const productBySlug: Record<string, { id: string; config: ProductConfig }> = {};
  for (const seedProduct of SEED_PRODUCTS) {
    const themeId = themeIdBySlug[seedProduct.themeSlug]!;
    productBySlug[seedProduct.slug] = await upsertSeedProduct(tx, seedProduct.slug, themeId, ownerId);
  }

  await deleteSeedOwnedUsage(tx);

  for (const target of SEED_USAGE_TARGETS) {
    const product = productBySlug[target.slug];
    if (!product) continue;
    const pack = product.config.pricing.packs.find((candidate) => candidate.id === target.packId);
    if (!pack) throw new Error(`applySeed: unknown pack ${target.packId} for ${target.slug}`);
    const fixtures = readGenerationFixtures(target.slug);
    const plan = buildSeedUsage(target, pack, fixtures, product.config.generation.model, now);
    await insertSeedUsage(tx, product.id, target.slug, plan);
  }
}

export async function seed(opts: { sql?: postgres.Sql; now?: Date } = {}): Promise<void> {
  const credentials = resolveCredentials();
  if (process.env.DEMO_MODE === "true" && credentials.usingDevDefaults) {
    throw new Error(
      "seed: refusing to run with the dev admin/owner credentials while DEMO_MODE=true. " +
        "Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD.",
    );
  }

  const ownsSql = !opts.sql;
  const sqlClient = opts.sql ?? postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 5, onnotice: () => {} });
  const db = createSeedDb(sqlClient);
  try {
    await db.transaction(async (tx) => {
      await applySeed(tx, opts.now ?? new Date());
    });
    console.log(
      "Seed complete: 4 themes, 3 locked products (LettrePro/DescriPro/NomDeMarque), admin and owner accounts, default thresholds, 30 days of usage.",
    );
  } finally {
    if (ownsSql) await sqlClient.end({ timeout: 5 });
  }
}

// Only run when executed directly (mirrors scripts/worktree-db.ts), so tests
// can import `seed()` without triggering it.
const isEntry = (): boolean => {
  try {
    return !!process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};
if (isEntry()) {
  seed()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
