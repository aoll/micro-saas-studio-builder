import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { generations, products } from "@/lib/db/schema";

const getSession = vi.fn();
vi.mock("./session", () => ({ getSession: () => getSession() }));

afterEach(() => {
  getSession.mockReset();
});

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

describe("recordGeneration", () => {
  it("inserts a pending row for an anonymous generation (no session)", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration } = await import("./generations");
    const idempotencyKey = randomUUID();
    const result = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: { poste: "Développeur" },
      idempotencyKey,
    });
    expect(result.id).toBeTruthy();

    const row = await db.query.generations.findFirst({ where: eq(generations.id, result.id) });
    expect(row?.status).toBe("pending");
    await db.delete(generations).where(eq(generations.id, result.id));
  });

  it("is idempotent: a replay with the same key returns the same id, one row", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { recordGeneration } = await import("./generations");
    const idempotencyKey = randomUUID();
    const args = {
      productId: await lettreProId(),
      productVersion: 1,
      userId: randomUser!.id,
      anonymousId: null,
      ipHash: "hash",
      input: { poste: "Développeur" },
      idempotencyKey,
    };
    const first = await recordGeneration(args);
    const second = await recordGeneration(args);
    expect(second.id).toBe(first.id);

    const rows = await db.select().from(generations).where(eq(generations.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    await db.delete(generations).where(eq(generations.id, first.id));
  });

  it("throws when userId does not match the session", async () => {
    const randomUser = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: randomUser!.id } });
    const { recordGeneration } = await import("./generations");
    await expect(
      recordGeneration({
        productId: await lettreProId(),
        productVersion: 1,
        userId: "someone-else",
        anonymousId: null,
        ipHash: "hash",
        input: {},
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow();
  });
});

describe("saveGeneration", () => {
  it("marks a generation succeeded with its tokens, cost and model", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, saveGeneration } = await import("./generations");
    const { id } = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });

    await saveGeneration(id, {
      output: "Lettre générée",
      model: "anthropic/claude-haiku-4.5",
      inputTokens: 200,
      outputTokens: 140,
      cachedInputTokens: 0,
      costMicros: 300,
    });

    const row = await db.query.generations.findFirst({ where: eq(generations.id, id) });
    expect(row?.status).toBe("succeeded");
    expect(row?.model).toBe("anthropic/claude-haiku-4.5");
    expect(row?.inputTokens).toBe(200);
    expect(row?.costMicros).toBe(300);
    await db.delete(generations).where(eq(generations.id, id));
  });
});

describe("markGenerationFailed", () => {
  it("marks a generation failed", async () => {
    getSession.mockResolvedValue(null);
    const { recordGeneration, markGenerationFailed } = await import("./generations");
    const { id } = await recordGeneration({
      productId: await lettreProId(),
      productVersion: 1,
      userId: null,
      anonymousId: randomUUID(),
      ipHash: "hash",
      input: {},
      idempotencyKey: randomUUID(),
    });

    await markGenerationFailed(id);
    const row = await db.query.generations.findFirst({ where: eq(generations.id, id) });
    expect(row?.status).toBe("failed");
    await db.delete(generations).where(eq(generations.id, id));
  });
});
