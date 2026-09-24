import { describe, expect, it, vi } from "vitest";
import { costMicros } from "./generate";

// docs/05-ia.md › Consommation de tokens: Haiku 4.5 1 $ / 5 $ per million
// input / output tokens, Sonnet 5 2 $ / 10 $. costMicros expresses the
// price in micro-dollars per token (docs/07: `cost_micros`, "évite les
// arrondis"), so 1 $/M tokens = 1 micro-dollar/token.
describe("costMicros", () => {
  it("Haiku 4.5: 210 input, 140 output, 0 cached → 910 micro-dollars", () => {
    expect(
      costMicros("anthropic/claude-haiku-4.5", { inputTokens: 210, outputTokens: 140, cachedInputTokens: 0 }),
    ).toBe(910);
  });

  it("Sonnet 5 costs exactly double Haiku 4.5 for the same usage", () => {
    const usage = { inputTokens: 210, outputTokens: 140, cachedInputTokens: 0 };
    const haiku = costMicros("anthropic/claude-haiku-4.5", usage);
    const sonnet = costMicros("anthropic/claude-sonnet-5", usage);
    expect(sonnet).toBe(haiku * 2);
  });

  it("prices cached input tokens at 10% of the input rate", () => {
    // 100 non-cached at 1 + 100 cached at 0.1 + 0 output = 100 + 10 = 110
    const withoutCache = costMicros("anthropic/claude-haiku-4.5", {
      inputTokens: 100,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    const withCache = costMicros("anthropic/claude-haiku-4.5", {
      inputTokens: 200,
      outputTokens: 0,
      cachedInputTokens: 100,
    });
    expect(withoutCache).toBe(100);
    expect(withCache).toBe(110);
  });

  it("rounds up to the next micro-dollar", () => {
    // 1 input token at a fractional per-token rate would round; use cached
    // tokens to force a non-integer intermediate (1 * 0.1 = 0.1 → ceil 1).
    const result = costMicros("anthropic/claude-haiku-4.5", { inputTokens: 1, outputTokens: 0, cachedInputTokens: 1 });
    expect(result).toBe(1);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("treats undefined usage fields as 0", () => {
    expect(
      costMicros("anthropic/claude-haiku-4.5", {
        inputTokens: undefined,
        outputTokens: undefined,
        cachedInputTokens: undefined,
      }),
    ).toBe(0);
  });

  it("unknown model: falls back to the highest known rate and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const usage = { inputTokens: 210, outputTokens: 140, cachedInputTokens: 0 };
    const unknown = costMicros("openai/some-new-model", usage);
    const sonnet = costMicros("anthropic/claude-sonnet-5", usage);
    expect(unknown).toBe(sonnet);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
