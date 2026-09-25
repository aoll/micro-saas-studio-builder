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

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

afterEach(() => {
  checkBotId.mockReset();
  isGenerationRateLimited.mockReset();
  getSession.mockReset();
  headersMock.mockReset();
});

function human() {
  return { isBot: false, isHuman: true, isVerifiedBot: false, bypassed: false };
}

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

describe("guardRequest › rate-limit step (generate only, decision D1)", () => {
  it("returns { ok: false, reason: 'rate_limited' } for generate over the limit", async () => {
    checkBotId.mockResolvedValue(human());
    getSession.mockResolvedValue(null);
    headersMock.mockResolvedValue(new Headers());
    isGenerationRateLimited.mockResolvedValue(true);
    const { guardRequest } = await import("./security");
    expect(await guardRequest("generate")).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("returns { ok: true } for generate under the limit", async () => {
    checkBotId.mockResolvedValue(human());
    getSession.mockResolvedValue(null);
    headersMock.mockResolvedValue(new Headers());
    isGenerationRateLimited.mockResolvedValue(false);
    const { guardRequest } = await import("./security");
    expect(await guardRequest("generate")).toEqual({ ok: true });
  });

  it("derives userId from the session and ipHash from hashIp(clientIp(headers()))", async () => {
    checkBotId.mockResolvedValue(human());
    getSession.mockResolvedValue({ user: { id: "user-1" } });
    headersMock.mockResolvedValue(new Headers());
    isGenerationRateLimited.mockResolvedValue(false);
    const { guardRequest } = await import("./security");
    const { hashIp } = await import("@/lib/dal/generations");
    await guardRequest("generate");
    expect(isGenerationRateLimited).toHaveBeenCalledWith({ userId: "user-1", ipHash: hashIp("203.0.113.42") });
  });

  it("passes userId: null for an anonymous (no-session) caller", async () => {
    checkBotId.mockResolvedValue(human());
    getSession.mockResolvedValue(null);
    headersMock.mockResolvedValue(new Headers());
    isGenerationRateLimited.mockResolvedValue(false);
    const { guardRequest } = await import("./security");
    await guardRequest("generate");
    expect(isGenerationRateLimited).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it.each(["signup", "purchase", "test-prompt"] as const)(
    "never calls the rate limiter for %s (decision D1)",
    async (kind) => {
      checkBotId.mockResolvedValue(human());
      const { guardRequest } = await import("./security");
      expect(await guardRequest(kind)).toEqual({ ok: true });
      expect(isGenerationRateLimited).not.toHaveBeenCalled();
    },
  );

  it("calls checkBotId before the rate limiter", async () => {
    const order: string[] = [];
    checkBotId.mockImplementation(async () => {
      order.push("bot");
      return human();
    });
    getSession.mockResolvedValue(null);
    headersMock.mockResolvedValue(new Headers());
    isGenerationRateLimited.mockImplementation(async () => {
      order.push("rate-limit");
      return false;
    });
    const { guardRequest } = await import("./security");
    await guardRequest("generate");
    expect(order).toEqual(["bot", "rate-limit"]);
  });
});
