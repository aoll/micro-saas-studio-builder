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
  it("sets a fresh anonymous_id cookie and tracks a visit when there is no cookie", async () => {
    const bodyId = randomUUID();
    const response = await callPost(post({ body: { type: "visit", anonymousId: bodyId } }));

    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "visit", productId: "product-1", anonymousId: bodyId }),
    );
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${ANONYMOUS_ID_COOKIE}=${bodyId}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Max-Age=31536000");
  });

  it("uses the existing cookie and sets no new one when it is a valid uuid", async () => {
    const cookieId = randomUUID();
    const bodyId = randomUUID();
    const response = await callPost(
      post({ body: { type: "visit", anonymousId: bodyId }, cookie: `${ANONYMOUS_ID_COOKIE}=${cookieId}` }),
    );

    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: cookieId }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("resets to the body id when the cookie is not a valid uuid", async () => {
    const bodyId = randomUUID();
    const response = await callPost(
      post({ body: { type: "visit", anonymousId: bodyId }, cookie: `${ANONYMOUS_ID_COOKIE}=not-a-uuid` }),
    );

    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ anonymousId: bodyId }));
    expect(response.headers.get("set-cookie")).toContain(`${ANONYMOUS_ID_COOKIE}=${bodyId}`);
  });

  it("marks the cookie Secure on an https request", async () => {
    const bodyId = randomUUID();
    const response = await callPost(
      post({ body: { type: "visit", anonymousId: bodyId }, url: "https://demo.example/lettre-pro/api/events" }),
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("forwards metadata to track", async () => {
    const bodyId = randomUUID();
    await callPost(post({ body: { type: "visit", anonymousId: bodyId, metadata: { referrer: "seo" } } }));
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
      await expect(callPost(post({ body: { type: "visit", anonymousId: randomUUID() } }))).rejects.toThrow("db down");
    });
  });
});
