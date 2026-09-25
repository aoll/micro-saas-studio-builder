import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function post(options: { body: unknown; cookie?: string; origin?: string; url?: string }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);
  const request = new NextRequest(options.url ?? "http://demo.example/lettre-pro/api/events", {
    method: "POST",
    headers,
    body: JSON.stringify(options.body),
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
});
