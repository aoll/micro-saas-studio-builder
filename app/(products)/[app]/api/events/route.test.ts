import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventTypeSchema } from "@/lib/schemas/event-type";
import { ANONYMOUS_ID_COOKIE } from "./anonymous-id";

const getProduct = vi.fn();
const track = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));
vi.mock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));

const PRODUCT = { id: "product-1", slug: "lettre-pro", status: "test" };

beforeEach(() => {
  getProduct.mockReset();
  track.mockReset();
  getProduct.mockResolvedValue(PRODUCT);
  track.mockResolvedValue(undefined);
});

function post(options: { body?: unknown; raw?: string; cookie?: string; origin?: string; url?: string }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);
  const request = new NextRequest(options.url ?? "http://demo.example/lettre-pro/api/events", {
    method: "POST",
    headers,
    body: options.raw ?? JSON.stringify(options.body),
  });
  return request;
}

async function callPost(request: NextRequest, app = "lettre-pro") {
  const { POST } = await import("./route");
  return POST(request, { params: Promise.resolve({ app }) });
}

describe("POST /[app]/api/events", () => {
  it("two concurrent cookieless visit beacons never create two visitors (B4)", async () => {
    // Reproduces QA1-P1-B4: two beacons of the same page load, each with its
    // own client-minted id, race in before any cookie exists. The route must
    // never let a body-supplied anonymousId reach track(): at most one
    // identity (from a cookie) is ever tracked, and neither client id is it.
    const bodyIdA = randomUUID();
    const bodyIdB = randomUUID();

    await Promise.all([
      callPost(post({ body: { type: "visit", anonymousId: bodyIdA } })),
      callPost(post({ body: { type: "visit", anonymousId: bodyIdB } })),
    ]);

    const trackedIds = track.mock.calls.map(([event]) => (event as { anonymousId: string }).anonymousId);
    expect(new Set(trackedIds).size).toBeLessThanOrEqual(1);
    expect(trackedIds).not.toContain(bodyIdA);
    expect(trackedIds).not.toContain(bodyIdB);
  });

  it("without a cookie: 204, no track, no Set-Cookie", async () => {
    const bodyId = randomUUID();
    const response = await callPost(post({ body: { type: "visit", anonymousId: bodyId } }));

    expect(response.status).toBe(204);
    expect(track).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the existing cookie to track the visit", async () => {
    const cookieId = randomUUID();
    const bodyId = randomUUID();
    const response = await callPost(
      post({ body: { type: "visit", anonymousId: bodyId }, cookie: `${ANONYMOUS_ID_COOKIE}=${cookieId}` }),
    );

    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: cookieId }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("an invalid cookie reads as no cookie: 204, no track, no Set-Cookie", async () => {
    const bodyId = randomUUID();
    const response = await callPost(
      post({ body: { type: "visit", anonymousId: bodyId }, cookie: `${ANONYMOUS_ID_COOKIE}=not-a-uuid` }),
    );

    expect(response.status).toBe(204);
    expect(track).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("forwards metadata to track", async () => {
    const cookieId = randomUUID();
    const bodyId = randomUUID();
    await callPost(
      post({
        body: { type: "visit", anonymousId: bodyId, metadata: { referrer: "seo" } },
        cookie: `${ANONYMOUS_ID_COOKIE}=${cookieId}`,
      }),
    );
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ metadata: { referrer: "seo" } }));
  });

  describe("rejections (track is never called)", () => {
    it("rejects a body over 2048 bytes with 413", async () => {
      const response = await callPost(
        post({ raw: JSON.stringify({ type: "visit", anonymousId: randomUUID(), padding: "x".repeat(3000) }) }),
      );
      expect(response.status).toBe(413);
      expect(track).not.toHaveBeenCalled();
      expect(getProduct).not.toHaveBeenCalled();
    });

    it("rejects via a declared Content-Length over the cap without reading the stream", async () => {
      // The Streams spec eagerly pulls once at construction to fill the
      // queue to its default highWaterMark, before anyone calls
      // getReader().read() — that single pull is unavoidable and happens
      // whether or not the route ever looks at the body. What the route
      // must never do is call read() itself: pulls stays at that one
      // baseline call instead of growing with every read().
      let pulls = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          controller.enqueue(new TextEncoder().encode("x"));
        },
      });
      const request = new NextRequest("http://demo.example/lettre-pro/api/events", {
        method: "POST",
        headers: new Headers({ "content-type": "application/json", "content-length": "3000" }),
        body: stream,
        duplex: "half",
      });

      const response = await callPost(request);

      expect(response.status).toBe(413);
      expect(pulls).toBeLessThanOrEqual(1);
      expect(track).not.toHaveBeenCalled();
    });

    it("cancels a streamed body without Content-Length once it exceeds the cap", async () => {
      // Finite source (never an infinite stream, docs/11's monitoring
      // guardrail): at most 1 MB total in 1 KB chunks, well over
      // MAX_BODY_BYTES (2 KB), so the route must cancel long before the
      // source closes on its own.
      const MAX_CHUNKS = 1024;
      let pulls = 0;
      let cancelled = false;
      const chunk = new TextEncoder().encode("x".repeat(1024));
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls++;
          if (pulls > MAX_CHUNKS) {
            controller.close();
            return;
          }
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      });
      const request = new NextRequest("http://demo.example/lettre-pro/api/events", {
        method: "POST",
        headers: new Headers({ "content-type": "application/json" }),
        body: stream,
        duplex: "half",
      });

      const response = await callPost(request);

      expect(response.status).toBe(413);
      expect(cancelled).toBe(true);
      expect(pulls).toBeLessThanOrEqual(4);
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects a foreign Origin with 403", async () => {
      const response = await callPost(
        post({ body: { type: "visit", anonymousId: randomUUID() }, origin: "https://evil.example" }),
      );
      expect(response.status).toBe(403);
      expect(track).not.toHaveBeenCalled();
    });

    it("accepts a same-origin Origin header", async () => {
      const response = await callPost(
        post({
          body: { type: "visit", anonymousId: randomUUID() },
          url: "http://demo.example/lettre-pro/api/events",
          origin: "http://demo.example",
        }),
      );
      expect(response.status).toBe(204);
    });

    it("rejects a malformed slug with 404, without calling getProduct", async () => {
      const response = await callPost(post({ body: { type: "visit", anonymousId: randomUUID() } }), "Bad Slug");
      expect(response.status).toBe(404);
      expect(getProduct).not.toHaveBeenCalled();
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects the reserved slug admin with 404, without calling getProduct", async () => {
      const response = await callPost(post({ body: { type: "visit", anonymousId: randomUUID() } }), "admin");
      expect(response.status).toBe(404);
      expect(getProduct).not.toHaveBeenCalled();
    });

    it("rejects invalid JSON with 400", async () => {
      const response = await callPost(post({ raw: "not json" }));
      expect(response.status).toBe(400);
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects a non-uuid anonymousId with 400", async () => {
      const response = await callPost(post({ body: { type: "visit", anonymousId: "not-a-uuid" } }));
      expect(response.status).toBe(400);
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects metadata with more than 10 keys with 400", async () => {
      const metadata = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, "v"]));
      const response = await callPost(post({ body: { type: "visit", anonymousId: randomUUID(), metadata } }));
      expect(response.status).toBe(400);
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects a metadata string value over 200 characters with 400", async () => {
      const response = await callPost(
        post({ body: { type: "visit", anonymousId: randomUUID(), metadata: { referrer: "x".repeat(201) } } }),
      );
      expect(response.status).toBe(400);
      expect(track).not.toHaveBeenCalled();
    });

    it.each(eventTypeSchema.options.filter((type) => type !== "visit"))(
      "rejects the non-public type %s with 403",
      async (type) => {
        const response = await callPost(post({ body: { type, anonymousId: randomUUID() } }));
        expect(response.status).toBe(403);
        expect(track).not.toHaveBeenCalled();
      },
    );

    it("rejects an unknown product with 404", async () => {
      getProduct.mockResolvedValue(null);
      const response = await callPost(post({ body: { type: "visit", anonymousId: randomUUID() } }));
      expect(response.status).toBe(404);
      expect(track).not.toHaveBeenCalled();
    });

    it("rejects a killed product with 404", async () => {
      getProduct.mockResolvedValue({ ...PRODUCT, status: "killed" });
      const response = await callPost(post({ body: { type: "visit", anonymousId: randomUUID() } }));
      expect(response.status).toBe(404);
      expect(track).not.toHaveBeenCalled();
    });
  });

  describe("failures are not swallowed", () => {
    it("propagates a track() rejection", async () => {
      track.mockRejectedValue(new Error("db down"));
      await expect(
        callPost(
          post({
            body: { type: "visit", anonymousId: randomUUID() },
            cookie: `${ANONYMOUS_ID_COOKIE}=${randomUUID()}`,
          }),
        ),
      ).rejects.toThrow("db down");
    });
  });
});
