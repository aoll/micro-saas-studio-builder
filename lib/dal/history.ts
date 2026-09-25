import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { getSession } from "./session";

// SA-06 (specs/SA-06-historique.md): this contract does not exist before
// this spec (docs/11's contract table lists no `lib/dal/history.ts` stub),
// so its signature is created here, literally as the spec states it, and
// pinned by this module's test (`expectTypeOf`).

export const HISTORY_PAGE_SIZE = 20;

export type HistoryEntry = {
  id: string;
  createdAt: Date;
  input: Record<string, string>;
  output: string;
};

export type HistoryPage = {
  entries: HistoryEntry[];
  page: number;
  total: number;
  hasMore: boolean;
};

// Normalizes a generation's jsonb `output` (docs/07: text or a structured
// object) to a single displayable string. Structured outputs are shown as
// pretty JSON: SA-06 does not render an object result specially.
function normalizeOutput(output: unknown): string {
  if (typeof output === "string") return output;
  return JSON.stringify(output, null, 2);
}

function normalizeInput(input: unknown): Record<string, string> {
  return (input ?? {}) as Record<string, string>;
}

// Signed-in: `userOrAnonId` must be the caller's own session user id (never
// trusted from client input, CLAUDE.md). Anonymous: `userOrAnonId` is the
// value read from the httpOnly `anonymous_id` cookie by the caller, and only
// rows with no `user_id` are matched — a signed-in user's earlier anonymous
// rows are not merged into their account here (out of scope, plan §
// "Anonymous history does not follow signup").
export async function listGenerations(userOrAnonId: string, productId: string, page: number): Promise<HistoryPage> {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`listGenerations: page must be a positive integer, got ${page}`);
  }

  const session = await getSession();
  if (session && userOrAnonId !== session.user.id) {
    throw new Error("listGenerations: userOrAnonId does not match the caller's session");
  }

  const identity = session
    ? and(eq(generations.productId, productId), eq(generations.userId, userOrAnonId))
    : and(eq(generations.productId, productId), eq(generations.anonymousId, userOrAnonId), isNull(generations.userId));

  const where = and(identity, eq(generations.status, "succeeded"));

  const [rows, totalRows] = await Promise.all([
    db.query.generations.findMany({
      where,
      orderBy: [desc(generations.createdAt), desc(generations.id)],
      limit: HISTORY_PAGE_SIZE,
      offset: (page - 1) * HISTORY_PAGE_SIZE,
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(generations)
      .where(where),
  ]);

  const total = totalRows[0]?.count ?? 0;

  return {
    entries: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      input: normalizeInput(row.input),
      output: normalizeOutput(row.output),
    })),
    page,
    total,
    hasMore: page * HISTORY_PAGE_SIZE < total,
  };
}
