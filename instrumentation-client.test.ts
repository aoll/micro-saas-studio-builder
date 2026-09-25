import { describe, expect, it, vi } from "vitest";

// SECURITY (specs/SECURITY.md, plan task 8): instrumentation-client.ts's
// protect list must cover every POST origin guardRequest checks
// server-side (SA-02, SA-03, SA-05, BO-05's "Tester le prompt").
const initBotId = vi.fn();
vi.mock("botid/client/core", () => ({ initBotId: (...args: unknown[]) => initBotId(...args) }));

describe("instrumentation-client", () => {
  it("calls initBotId with every protected POST origin", async () => {
    await import("./instrumentation-client");
    expect(initBotId).toHaveBeenCalledWith({
      protect: [
        { path: "/*/api/generate", method: "POST" },
        { path: "/*/signup", method: "POST" },
        { path: "/*/checkout/*", method: "POST" },
        { path: "/admin/products/new", method: "POST" },
        { path: "/admin/products/*/edit", method: "POST" },
      ],
    });
  });
});
