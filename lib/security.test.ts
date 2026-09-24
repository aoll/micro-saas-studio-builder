import { describe, expect, it } from "vitest";

// V1 stub (docs/11 › Les contrats gelés en V1: "guardRequest(kind) : laisse
// tout passer"). Replaced by SECURITY's real BotID + Postgres rate limit.
describe("guardRequest", () => {
  it.each(["generate", "signup", "purchase", "test-prompt"] as const)("lets %s through", async (kind) => {
    const { guardRequest } = await import("./security");
    expect(await guardRequest(kind)).toEqual({ ok: true });
  });
});
