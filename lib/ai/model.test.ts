import { generateText, streamText } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import bioInstagramFixture from "@/fixtures/bio-instagram.json";
import descriProFixture from "@/fixtures/descri-pro.json";
import fixture from "@/fixtures/lettre-pro.json";
import nomDeMarqueFixture from "@/fixtures/nom-de-marque.json";

type ProductFixture = { input: Record<string, string>; text: string; usage: Record<string, number> };

const [firstFixture] = fixture as ProductFixture[];

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

  it("in AI_MODE=mock, spaces the chunks about 30 ms apart so the UI visibly streams (docs/05)", async () => {
    const { resolveModel } = await import("./model");
    const arrivals: number[] = [];
    const result = streamText({ model: resolveModel("anthropic/claude-haiku-4.5", "lettre-pro"), prompt: "x" });
    for await (const delta of result.textStream) if (delta) arrivals.push(performance.now());
    const gaps = arrivals.slice(1).map((at, i) => at - arrivals[i]!);
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    // Lenient lower bound: timers never fire early, and the former 5 ms
    // delay (QA1 B15) stays well under it.
    expect(averageGap).toBeGreaterThanOrEqual(20);
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

  // DEMO-mode (human decision, round 3, 2026-09-25): every seeded product's
  // own fixture is served, not only LettrePro's — DescriPro and
  // NomDeMarque (seeded), and BioInsta (never seeded, but pasted live into
  // BO-05 during the demo script, so its generations must resolve too).
  it.each([
    { slug: "descri-pro", fixtures: descriProFixture },
    { slug: "nom-de-marque", fixtures: nomDeMarqueFixture },
    { slug: "bio-instagram", fixtures: bioInstagramFixture },
  ])("serves $slug's own fixture, not LettrePro's", async ({ slug, fixtures }) => {
    const [expected] = fixtures as ProductFixture[];
    const { resolveModel } = await import("./model");
    const result = await generateText({ model: resolveModel("anthropic/claude-haiku-4.5", slug), prompt: "x" });
    expect(result.text).toBe(expected!.text);
    expect(result.text).not.toBe(firstFixture!.text);
  });

  it("in AI_MODE=live, returns the model id unchanged", async () => {
    vi.stubEnv("AI_MODE", "live");
    vi.resetModules();
    const { resolveModel } = await import("./model");
    expect(resolveModel("anthropic/claude-haiku-4.5", "lettre-pro")).toBe("anthropic/claude-haiku-4.5");
  });
});
