import "server-only";

// Micro-dollars per token (docs/05-ia.md › Consommation de tokens, tarifs
// Anthropic relevés le 23 septembre 2026): 1 $ per million tokens = 1
// micro-dollar per token. Cached input tokens are priced separately
// (docs/05: prompt caching reduces the input-token cost).
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
};
// An unknown model (a fallback model not in the catalogue above, or a
// future one) is priced at the highest known rate rather than under-billed
// (CLAUDE.md: no silent failure) — logged so it gets added to the table.
const HIGHEST_KNOWN_RATE = { input: 2, output: 10 };
const CACHED_INPUT_DISCOUNT = 0.1;

export type GenerationUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  cachedInputTokens: number | undefined;
};

// Coût IA par génération (docs/07 › `cost_micros`, docs/05 › onFinish):
// non-cached input tokens at the full input rate, cached input tokens at
// 10 % of it, output tokens at the output rate; rounded up so the demo
// never under-reports its own AI spend.
export function costMicros(model: string, usage: GenerationUsage): number {
  const rate = MODEL_RATES[model];
  if (!rate) {
    console.warn(`costMicros: unknown model "${model}", pricing at the highest known rate`);
  }
  const { input, output } = rate ?? HIGHEST_KNOWN_RATE;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const nonCachedInputTokens = inputTokens - cachedInputTokens;

  const cost = nonCachedInputTokens * input + cachedInputTokens * input * CACHED_INPUT_DISCOUNT + outputTokens * output;
  return Math.ceil(cost);
}
