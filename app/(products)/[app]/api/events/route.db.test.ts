// QA1-P1-B4, verified against the real DAL: only `getProduct` is mocked, so
// `track()` runs its real advisory-lock dedupe (lib/dal/events.ts). These
// tests need real, separate connections for genuinely concurrent requests
// (tdd-workflow skill: postgres.js never releases a savepoint, so
// `withTestTransaction` is not used here), same pattern as
// lib/dal/events.test.ts's own concurrency tests.
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { events, products } from "@/lib/db/schema";
import { ANONYMOUS_ID_COOKIE } from "./anonymous-id";

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

function post(options: { cookie?: string; anonymousId?: string }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", `${ANONYMOUS_ID_COOKIE}=${options.cookie}`);
  return new NextRequest("http://demo.example/lettre-pro/api/events", {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "visit", anonymousId: options.anonymousId ?? randomUUID() }),
  });
}

async function callPost(request: NextRequest) {
  const { POST } = await import("./route");
  return POST(request, { params: Promise.resolve({ app: "lettre-pro" }) });
}

beforeEach(async () => {
  getProduct.mockReset();
  const id = await lettreProId();
  getProduct.mockResolvedValue({ id, slug: "lettre-pro", status: "test" });
});

describe("POST /[app]/api/events against the real DAL (B4)", () => {
  it("2 concurrent beacons with the same fresh cookie, then a reload, write exactly 1 visit row", async () => {
    const cookieId = randomUUID();
    try {
      await Promise.all([post({ cookie: cookieId }), post({ cookie: cookieId })].map((request) => callPost(request)));
      await callPost(post({ cookie: cookieId }));

      const rows = await db.select().from(events).where(eq(events.anonymousId, cookieId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe("visit");
    } finally {
      await db.delete(events).where(eq(events.anonymousId, cookieId));
    }
  });

  it("2 concurrent cookieless beacons write 0 rows for either body id", async () => {
    const bodyIdA = randomUUID();
    const bodyIdB = randomUUID();

    const responses = await Promise.all(
      [post({ anonymousId: bodyIdA }), post({ anonymousId: bodyIdB })].map((request) => callPost(request)),
    );
    expect(responses.every((response) => response.status === 204)).toBe(true);

    const rowsA = await db.select().from(events).where(eq(events.anonymousId, bodyIdA));
    const rowsB = await db.select().from(events).where(eq(events.anonymousId, bodyIdB));
    expect(rowsA).toHaveLength(0);
    expect(rowsB).toHaveLength(0);
  });
});
