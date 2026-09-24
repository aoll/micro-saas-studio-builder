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
// calendar day (docs/01-produit.md's funnel counts a visit once): dedupe
// has no unique index to lean on (docs/07), so it runs inside a
// transaction holding a Postgres advisory lock keyed on
// `visit:{productId}:{anonymousId}`, which serializes concurrent calls for
// the same key without serializing unrelated ones.
export const track: (event: TrackEvent) => Promise<void> = async (event) => {
  if (!event.userId && !event.anonymousId) {
    throw new Error("track: needs a userId or an anonymousId");
  }
  if (event.type === "visit" && !event.anonymousId) {
    throw new Error("track: visit needs an anonymousId");
  }
  if (event.userId) {
    const session = await getSession();
    if (session?.user.id !== event.userId) {
      throw new Error("track: userId does not match the caller's session");
    }
  }

  const metadata = event.metadata ?? null;

  if (event.type !== "visit") {
    await db.insert(events).values({
      productId: event.productId,
      type: event.type,
      userId: event.userId,
      anonymousId: event.anonymousId,
      metadata,
    });
    return;
  }

  const anonymousId = event.anonymousId!;
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  await db.transaction(async (tx) => {
    const lockKey = `visit:${event.productId}:${anonymousId}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const existing = await tx.query.events.findFirst({
      where: and(
        eq(events.productId, event.productId),
        eq(events.type, "visit"),
        eq(events.anonymousId, anonymousId),
        gte(events.createdAt, dayStart),
      ),
    });
    if (existing) return;

    await tx.insert(events).values({
      productId: event.productId,
      type: "visit",
      userId: event.userId,
      anonymousId,
      metadata,
    });
  });
};
