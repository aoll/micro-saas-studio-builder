// Idempotent local seed (specs/CONTRACT-data.md): the 4 dossier themes
// (docs/01-produit.md › Thèmes seedés pour la démo), LettrePro (one of the
// 4 seeded products, docs/01 › Contenu des produits seedés), the admin and
// owner accounts, and the studio's default decision thresholds
// (docs/07-modele-de-donnees.md). This script never imports
// `lib/db/index.ts` (`import "server-only"`) or `lib/env.ts` (which requires
// all 8 variables): it builds its own client from `DATABASE_URL` alone, like
// scripts/worktree-db.ts.
//
// Usage: pnpm tsx scripts/seed.ts (wired to `pnpm db:seed`)
import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Namespace import: see the comment in drizzle.config.ts.
import * as nextEnvNs from "@next/env";

const { loadEnvConfig } = (nextEnvNs as { default?: typeof nextEnvNs }).default ?? nextEnvNs;
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { accounts, users } from "../lib/db/auth-schema";
import { decisionThresholds, productVersions, products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { productConfigSchema } from "../lib/schemas/product-config";
import type { LandingVariant } from "../lib/schemas/theme-tokens";
import type { ThemeTokens } from "../lib/schemas/theme-tokens";

loadEnvConfig(process.cwd());

// Dev-only constants: the demo runs entirely locally in this spec (no
// deployment, no Neon, no Vercel). A public deployment needs real secrets;
// noted in the PR (DEMO-mode will own that).
export const SEED_ADMIN = { email: "admin@msb.local", password: "dev-admin-password-msb" };
export const SEED_OWNER = { email: "owner@msb.local", password: "dev-owner-password-msb" };

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

const createDb = (sql: postgres.Sql) =>
  drizzle(sql, { schema: { products, productVersions, themes, decisionThresholds, users, accounts } });

type SeedDb = ReturnType<typeof createDb>;
type SeedTx = Parameters<Parameters<SeedDb["transaction"]>[0]>[0];

async function seedCredentialUser(
  tx: SeedTx,
  seedUser: { email: string; password: string },
  name: string,
  role: "admin" | "owner",
): Promise<string> {
  const existing = await tx.query.users.findFirst({ where: eq(users.email, seedUser.email) });
  if (existing) return existing.id;
  const id = randomUUID();
  await tx.insert(users).values({ id, name, email: seedUser.email, emailVerified: true, role });
  await tx.insert(accounts).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(seedUser.password),
  });
  return id;
}

export async function seed(): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 5, onnotice: () => {} });
  const db = createDb(sql);
  try {
    await db.transaction(async (tx) => {
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

      await seedCredentialUser(tx, SEED_ADMIN, "Admin", "admin");
      const ownerId = await seedCredentialUser(tx, SEED_OWNER, "Owner", "owner");

      const editorialId = themeIdBySlug.editorial!;
      const rawConfig: unknown = JSON.parse(readFileSync(new URL("lettre-pro.config.json", fixturesDir), "utf8"));
      const config = productConfigSchema.parse({ ...(rawConfig as object), themeId: editorialId });

      await tx
        .insert(products)
        .values({
          slug: config.slug,
          status: config.status,
          themeId: editorialId,
          currentVersion: 1,
          locale: config.locale,
          isSeed: true,
          createdBy: ownerId,
        })
        .onConflictDoNothing({ target: products.slug });
      const product = await tx.query.products.findFirst({ where: eq(products.slug, config.slug) });

      await tx
        .insert(productVersions)
        .values({ productId: product!.id, version: 1, config, createdBy: ownerId })
        .onConflictDoNothing({ target: [productVersions.productId, productVersions.version] });

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
    });
    console.log("Seed complete: 4 themes, LettrePro, admin and owner accounts, default thresholds.");
  } finally {
    await sql.end({ timeout: 5 });
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
