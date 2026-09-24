import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

const createDb = () => drizzle(postgres(env.DATABASE_URL), { schema: { ...schema, ...authSchema } });

// A module-level singleton, cached on `globalThis` so Next.js's dev server
// (which re-evaluates modules on every edit) does not open a fresh
// connection pool at each hot reload.
const globalForDb = globalThis as unknown as { msbDb?: ReturnType<typeof createDb> };

export const db = globalForDb.msbDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.msbDb = db;
