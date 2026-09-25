import "server-only";
import type { LanguageModel } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { z } from "zod";
import bioInstagramFixtures from "@/fixtures/bio-instagram.json";
import descriProFixtures from "@/fixtures/descri-pro.json";
import lettreProFixtures from "@/fixtures/lettre-pro.json";
import nomDeMarqueFixtures from "@/fixtures/nom-de-marque.json";
import { env } from "@/lib/env";

// docs/05-ia.md › Stratégie de mock: one entry point decides which model is
// really called. `streamGeneration` and `testPrompt` (later specs) never
// know whether they talk to a real model or a mock.

const fixtureSchema = z.object({
  input: z.record(z.string(), z.string()),
  text: z.string().min(1),
  usage: z.object({
    inputTokens: z.int().nonnegative(),
    outputTokens: z.int().nonnegative(),
    cachedInputTokens: z.int().nonnegative(),
  }),
});
const fixturesFileSchema = z.array(fixtureSchema).min(1);
type Fixture = z.infer<typeof fixtureSchema>;

// Fixtures registry (orchestrator decision 5, extended by DEMO-mode): one
// entry per product with a recorded fixture — the 3 seeded products, plus
// BioInsta (never seeded, but pasted live into BO-05 during the demo
// script: its generations still need to resolve in AI_MODE=mock). Any
// other slug (a product created live from scratch, an unseeded test slug)
// falls back to LettrePro's.
const FIXTURES: Record<string, Fixture[]> = {
  "lettre-pro": fixturesFileSchema.parse(lettreProFixtures),
  "descri-pro": fixturesFileSchema.parse(descriProFixtures),
  "nom-de-marque": fixturesFileSchema.parse(nomDeMarqueFixtures),
  "bio-instagram": fixturesFileSchema.parse(bioInstagramFixtures),
};
const FALLBACK_SLUG = "lettre-pro";

function fixturesFor(slug: string): Fixture[] {
  return FIXTURES[slug] ?? FIXTURES[FALLBACK_SLUG]!;
}

// ~5 words per chunk: the UI streams like a real model, without a real
// token count driving the split (docs/05).
function toTextChunks(text: string): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 5) {
    const chunk = words.slice(i, i + 5).join(" ");
    chunks.push(i === 0 ? chunk : ` ${chunk}`);
  }
  return chunks;
}

function toUsage(usage: Fixture["usage"]) {
  return {
    inputTokens: {
      total: usage.inputTokens,
      noCache: usage.inputTokens - usage.cachedInputTokens,
      cacheRead: usage.cachedInputTokens,
      cacheWrite: undefined,
    },
    outputTokens: { total: usage.outputTokens, text: usage.outputTokens, reasoning: undefined },
  };
}

function mockModelFor(slug: string): LanguageModel {
  const [fixture] = fixturesFor(slug);
  const usage = toUsage(fixture!.usage);
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs: 30, // docs/05 › Stratégie de mock: the UI streams like the real thing
        chunks: [
          { type: "text-start", id: "1" },
          ...toTextChunks(fixture!.text).map((delta) => ({ type: "text-delta" as const, id: "1", delta })),
          { type: "text-end", id: "1" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ],
      }),
    }),
    doGenerate: async () => ({
      content: [{ type: "text", text: fixture!.text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

// Frozen contract (specs/CONTRACT-data plan, task 11): `env.AI_MODE`
// (`lib/env.ts`) decides. `mock` (tests, dev, previews) never spends a
// token; `live` returns the model id string, resolved by the AI SDK's AI
// Gateway provider (docs/05-ia.md).
export function resolveModel(modelId: string, slug: string): LanguageModel {
  if (env.AI_MODE === "mock") return mockModelFor(slug);
  return modelId;
}
