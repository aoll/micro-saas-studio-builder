import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accounts, users } from "../lib/db/auth-schema";
import { products } from "../lib/db/schema";
import { SEED_ADMIN, seed } from "./seed";

const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema: { products, users, accounts } });

beforeAll(async () => {
  await seed();
  await seed(); // idempotent: run twice on purpose
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("seed", () => {
  it("creates exactly one demo product", async () => {
    const rows = await db.select().from(products).where(eq(products.slug, "demo"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("demo");
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
});
