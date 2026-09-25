import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import lettreProConfig from "@/fixtures/lettre-pro.config.json";
import lettreProFixtures from "@/fixtures/lettre-pro.json";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { costMicros, streamGeneration } from "./generate";

const resolveModel = vi.fn();
vi.mock("@/lib/ai/model", () => ({ resolveModel: (...args: unknown[]) => resolveModel(...args) }));

const [fixture] = lettreProFixtures as { input: Record<string, string>; text: string; usage: Record<string, number> }[];

const product: ProductConfig = { ...lettreProConfig, themeId: "00000000-0000-0000-0000-000000000000" } as ProductConfig;

function fixtureModel(doStreamSpy?: (options: unknown) => void) {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      doStreamSpy?.(options);
      return {
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          chunks: [
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: fixture!.text },
            { type: "text-end", id: "1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: { total: 210, noCache: 210, cacheRead: 0, cacheWrite: undefined },
                outputTokens: { total: 140, text: 140, reasoning: undefined },
              },
            },
          ],
        }),
      };
    },
  });
}

function failingModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs: 0,
        chunks: [
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "partiel" },
          { type: "error", error: new Error("provider unavailable") },
        ],
      }),
    }),
  });
}

afterEach(() => {
  resolveModel.mockReset();
});

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

describe("streamGeneration", () => {
  it("streams the model's text and calls onSuccess with the usage-derived GenerationResult", async () => {
    resolveModel.mockReturnValue(fixtureModel());
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const result = streamGeneration({ product, inputs: fixture!.input, onSuccess, onError });
    const chunks: string[] = [];
    for await (const delta of result.textStream) chunks.push(delta);
    expect(chunks.join("")).toBe(fixture!.text);

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledWith({
      output: fixture!.text,
      model: "anthropic/claude-haiku-4.5",
      inputTokens: 210,
      outputTokens: 140,
      cachedInputTokens: 0,
      costMicros: 910,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("resolves the model from the product's slug and model id", async () => {
    resolveModel.mockReturnValue(fixtureModel());
    const result = streamGeneration({ product, inputs: fixture!.input, onSuccess: vi.fn(), onError: vi.fn() });
    await result.consumeStream();
    expect(resolveModel).toHaveBeenCalledWith(product.generation.model, product.slug);
  });

  it("renders the prompt template from the inputs, and prefixes the safety system prompt", async () => {
    let captured: { system?: unknown; prompt?: unknown } = {};
    resolveModel.mockReturnValue(fixtureModel((options) => (captured = options as typeof captured)));
    const result = streamGeneration({ product, inputs: fixture!.input, onSuccess: vi.fn(), onError: vi.fn() });
    await result.consumeStream();

    const promptMessages = captured.prompt as Array<{ role: string; content: unknown }>;
    const systemMessage = promptMessages.find((message) => message.role === "system");
    expect(systemMessage?.content).toContain("tâche unique");

    const userMessage = promptMessages.find((message) => message.role === "user");
    const userText = (userMessage?.content as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
    expect(userText).toContain(`<poste>${fixture!.input.poste}</poste>`);
  });

  it("forwards the product's fallback models to the AI Gateway provider options", async () => {
    let captured: { providerOptions?: unknown } = {};
    resolveModel.mockReturnValue(fixtureModel((options) => (captured = options as typeof captured)));
    const withFallback: ProductConfig = {
      ...product,
      generation: { ...product.generation, fallbackModels: ["openai/gpt-5-mini"] },
    };
    const result = streamGeneration({
      product: withFallback,
      inputs: fixture!.input,
      onSuccess: vi.fn(),
      onError: vi.fn(),
    });
    await result.consumeStream();
    expect(captured.providerOptions).toMatchObject({ gateway: { models: ["openai/gpt-5-mini"] } });
  });

  it("on failure, calls onError once and never onSuccess", async () => {
    resolveModel.mockReturnValue(failingModel());
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const result = streamGeneration({ product, inputs: fixture!.input, onSuccess, onError });
    await result.consumeStream();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("on a synchronous doStream throw, calls onError once and never onSuccess", async () => {
    resolveModel.mockReturnValue(
      new MockLanguageModelV4({
        doStream: async () => {
          throw new Error("network down");
        },
      }),
    );
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const result = streamGeneration({ product, inputs: fixture!.input, onSuccess, onError });
    await result.consumeStream();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
