import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_URL: "https://studio.example.com/" } }));

describe("robots", () => {
  it("disallows /admin exactly and every path under it, without blocking a slug like admin-xyz", async () => {
    const { default: robots } = await import("./robots");
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/admin$", "/admin/"] });
  });

  it("points to an absolute sitemap URL, without a double slash", async () => {
    const { default: robots } = await import("./robots");
    const result = robots();
    expect(result.sitemap).toBe("https://studio.example.com/sitemap.xml");
  });
});
