import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { EventType } from "@/lib/schemas/event-type";
import { getSession } from "./session";

// Frozen contract (specs/CONTRACT-types.md): insert-only writes to `events`
// (docs/07). Called from Server Actions and Route Handlers with `after()`
// (generation, signup, purchase), and from `api/events` for the public
// `visit` type only (docs/04-nextjs.md: other types never accept a
// client-supplied event).
export type TrackEvent = {
  type: EventType;
  productId: string;
  userId: string | null;
  anonymousId: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

// Real implementation (specs/TRACKING.md), replacing the V1 no-op
// (docs/11's contract table). Identity rules: at least one of `userId` or
// `anonymousId` is required; `visit` always needs an `anonymousId` (the
// funnel's first step, and the id later linked to a signup); a non-null
// `userId` must match the caller's own session (same rule as
// `recordGeneration`, CLAUDE.md: every DAL module checks the session) — the
// session is only read when `userId` is provided, so an anonymous-only
// event (the public `visit`) never needs one.
//
// `visit` is deduped to at most one row per `anonymous_id`, product and UTC
// calendar day (docs/01-produit.md's funnel counts a visit once); `signup`
// to at most one row per product and `user_id` (TRACKING dedupe
// follow-up: a returning user's re-login through signup/complete must not
// inflate the funnel — grantSignupBonus was already idempotent, the event
// wasn't); `purchase` to at most one row per product and
// `metadata.purchaseKey` (same follow-up: a replayed purchase, double
// click or retry, must not either). None of the three has a unique index
// to lean on (docs/07 lists none for `events`), so all three run inside a
// transaction holding a Postgres advisory lock keyed on
// `{type}:{productId}:{dedupeKey}`, which serializes concurrent calls for
// the same key without serializing unrelated ones — the same shape for
// all three, only the key and the existence check's window differ.
export const track: (event: TrackEvent) => Promise<void> = async (event) => {
  if (!event.userId && !event.anonymousId) {
    throw new Error("track: needs a userId or an anonymousId");
  }
  if (event.userId) {
    const session = await getSession();
    if (session?.user.id !== event.userId) {
      throw new Error("track: userId does not match the caller's session");
    }
  }

  const metadata = event.metadata ?? null;

  if (event.type === "visit") {
    // Narrows `anonymousId` from `string | null` to `string` right where
    // it is used, instead of a non-null assertion on `event.anonymousId`.
    const { anonymousId } = event;
    if (!anonymousId) throw new Error("track: visit needs an anonymousId");

    await insertDeduped({
      lockKey: `visit:${event.productId}:${anonymousId}`,
      // The day boundary is computed in Postgres, not from the Node clock
      // (plan's design decision 3): every connection agrees on the same
      // `now()`, and a clock drift between app instances can never split
      // or merge a day's dedupe window.
      existsWhere: and(
        eq(events.productId, event.productId),
        eq(events.type, "visit"),
        eq(events.anonymousId, anonymousId),
        gte(events.createdAt, sql`date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`),
      ),
      values: { productId: event.productId, type: "visit", userId: event.userId, anonymousId, metadata },
    });
    return;
  }

  if (event.type === "signup" && event.userId) {
    const { userId } = event;
    await insertDeduped({
      lockKey: `signup:${event.productId}:${userId}`,
      existsWhere: and(eq(events.productId, event.productId), eq(events.type, "signup"), eq(events.userId, userId)),
      values: { productId: event.productId, type: "signup", userId, anonymousId: event.anonymousId, metadata },
    });
    return;
  }

  if (event.type === "purchase" && typeof metadata?.purchaseKey === "string") {
    const { purchaseKey } = metadata;
    await insertDeduped({
      lockKey: `purchase:${event.productId}:${purchaseKey}`,
      existsWhere: and(
        eq(events.productId, event.productId),
        eq(events.type, "purchase"),
        sql`${events.metadata} ->> 'purchaseKey' = ${purchaseKey}`,
      ),
      values: {
        productId: event.productId,
        type: "purchase",
        userId: event.userId,
        anonymousId: event.anonymousId,
        metadata,
      },
    });
    return;
  }

  await db.insert(events).values({
    productId: event.productId,
    type: event.type,
    userId: event.userId,
    anonymousId: event.anonymousId,
    metadata,
  });
};

type DedupedInsert = {
  lockKey: string;
  existsWhere: ReturnType<typeof and>;
  values: {
    productId: string;
    type: EventType;
    userId: string | null;
    anonymousId: string | null;
    metadata: TrackEvent["metadata"] | null;
  };
};

async function insertDeduped({ lockKey, existsWhere, values }: DedupedInsert): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const existing = await tx.query.events.findFirst({ where: existsWhere });
    if (existing) return;

    await tx.insert(events).values(values);
  });
}
