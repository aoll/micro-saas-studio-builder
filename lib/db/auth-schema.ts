// Better Auth tables, written by hand from the core schema of the installed
// version (node_modules/better-auth/.../db/get-tables + core/src/db/get-tables.ts,
// better-auth@1.7.6): table names plural, columns snake_case, matching the
// `drizzleAdapter(db, { provider: "pg", usePlural: true })` config in
// lib/auth.ts (docs/09-arborescence.md).
//
// `magic_link_outbox` is not a Better Auth table: it is where the simulated
// magic-link email (docs/08-stack.md) is stored instead of being sent.
//
// No `import "server-only"`: drizzle-kit and tsx import this module outside
// a request.
import { pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin", "owner"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const magicLinkOutbox = pgTable("magic_link_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  url: text("url").notNull(),
  // Our own table (not a Better Auth one): house convention is timestamptz
  // (docs/07-modele-de-donnees.md), unlike the four Better Auth tables above.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
