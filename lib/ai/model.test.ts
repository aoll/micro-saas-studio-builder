import { generateText, streamText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/fixtures/lettre-pro.json";

const [firstFixture] = fixture as { input: Record<string, string>; text: string; usage: Record<string, number> }[];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolveModel", () => {
  it("in AI_MODE=mock, streams the first fixture's text in more than one chunk", async () => {
    const { resolveModel } = await import("./model");
    const chunks: string[] = [];
    const result = streamText({ model: resolveModel("anthropic/claude-haiku-4.5", "lettre-pro"), prompt: "x" });
    for await (const delta of result.textStream) chunks.push(delta);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(firstFixture!.text);

    const usage = await result.usage;
    expect(usage.inputTokens).toBe(firstFixture!.usage.inputTokens);
    expect(usage.outputTokens).toBe(firstFixture!.usage.outputTokens);
  });

  it("generateText returns the full fixture text", async () => {
    const { resolveModel } = await import("./model");
    const result = await generateText({ model: resolveModel("anthropic/claude-haiku-4.5", "lettre-pro"), prompt: "x" });
    expect(result.text).toBe(firstFixture!.text);
  });

  it("falls back to the LettrePro fixture for an unknown slug", async () => {
    const { resolveModel } = await import("./model");
    const result = await generateText({
      model: resolveModel("anthropic/claude-haiku-4.5", "some-unseeded-product"),
      prompt: "x",
    });
    expect(result.text).toBe(firstFixture!.text);
  });

  it("in AI_MODE=live, returns the model id unchanged", async () => {
    vi.stubEnv("AI_MODE", "live");
    vi.resetModules();
    const { resolveModel } = await import("./model");
    expect(resolveModel("anthropic/claude-haiku-4.5", "lettre-pro")).toBe("anthropic/claude-haiku-4.5");
  });
});
