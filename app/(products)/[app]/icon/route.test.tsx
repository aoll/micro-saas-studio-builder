import { describe, expect, it, vi } from "vitest";

// QA2-P1-B2 (specs/qa/QA2-P1-B2-og-icon-404.md): this Route Handler exists
// solely to make the literal, un-hashed `/{slug}/icon` path respond (see
// this file's sibling `./route.tsx` for the full "why"). It's a thin
// delegate to `../icon`'s already-tested default export, so this test only
// asserts the delegation itself — the actual image rendering, 404/throw
// rules, and branding overrides stay covered by `../icon.test.tsx`. The
// literal-path regression itself (the reason this file exists) is covered
// by `e2e/seo.spec.ts`, since it's a routing behaviour, not something a
// unit test calling the function directly can observe.
const ICON_RESPONSE = new Response("icon-bytes");
const Icon = vi.fn(async (_context: { params: Promise<{ app: string }> }) => ICON_RESPONSE);
vi.mock("../icon", () => ({ default: (context: { params: Promise<{ app: string }> }) => Icon(context) }));

describe("[app]/icon/route", () => {
  it("GET forwards the { params } context to the icon.tsx default export and returns its response", async () => {
    const { GET } = await import("./route");
    const context = { params: Promise.resolve({ app: "lettre-pro" }) };
    const request = new Request("http://demo.example/lettre-pro/icon");

    const response = await GET(request, context);

    expect(Icon).toHaveBeenCalledWith(context);
    expect(response).toBe(ICON_RESPONSE);
  });
});
