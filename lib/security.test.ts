import { afterEach, describe, expect, it, vi } from "vitest";

// Replaces the V1 stub test ("lets %s through" — docs/11 › Les contrats
// gelés en V1: "guardRequest(kind) : laisse tout passer"). The stub
// contract is superseded by SECURITY's real guard: BotID first
// (`checkBotId()`), then — for `generate` only — the Postgres rate limit
// (SECURITY plan, decisions 2, 3, D1).
const checkBotId = vi.fn();
vi.mock("botid/server", () => ({ checkBotId: () => checkBotId() }));

const isGenerationRateLimited = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  isGenerationRateLimited: (...args: unknown[]) => isGenerationRateLimited(...args),
  clientIp: vi.fn(() => "203.0.113.42"),
}));

afterEach(() => {
  checkBotId.mockReset();
  isGenerationRateLimited.mockReset();
});

const KINDS = ["generate", "signup", "purchase", "test-prompt"] as const;

describe("guardRequest › bot step", () => {
  it.each(KINDS)("returns { ok: false, reason: 'bot' } for %s when BotID flags a bot", async (kind) => {
    checkBotId.mockResolvedValue({ isBot: true, isHuman: false, isVerifiedBot: false, bypassed: false });
    const { guardRequest } = await import("./security");
    expect(await guardRequest(kind)).toEqual({ ok: false, reason: "bot" });
  });

  it.each(KINDS)("never calls the rate limiter for %s when BotID flags a bot", async (kind) => {
    checkBotId.mockResolvedValue({ isBot: true, isHuman: false, isVerifiedBot: false, bypassed: false });
    const { guardRequest } = await import("./security");
    await guardRequest(kind);
    expect(isGenerationRateLimited).not.toHaveBeenCalled();
  });

  it("propagates a rejection from checkBotId (decision D5: no fail-open, no fail-closed masking)", async () => {
    checkBotId.mockRejectedValue(new Error("BotID unavailable"));
    const { guardRequest } = await import("./security");
    await expect(guardRequest("generate")).rejects.toThrow("BotID unavailable");
  });
});
