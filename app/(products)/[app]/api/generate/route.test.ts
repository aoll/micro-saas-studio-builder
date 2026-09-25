import { randomUUID } from "node:crypto";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { generations, products } from "@/lib/db/schema";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

// Anonymous cookie jar + request headers (plan's Phase 2 note): a plain
// object with a `set` spy stands in for next/headers's cookie store.
const cookieStore = { get: vi.fn(() => undefined as { value: string } | undefined), set: vi.fn() };
let testHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
  headers: async () => testHeaders,
}));

// next/server's `after()` needs a request context this test never sets up
// (real Next.js server only): keep the rest of the module real, and just
// collect callbacks to run (and await) manually once the response is
// drained. after() accepts either a callback or a promise directly (the
// route passes `result.consumeStream()`, a promise): normalize both to a
// zero-arg function so flushAfterCallbacks can call every entry the same way.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (task: unknown) => {
      afterCallbacks.push(typeof task === "function" ? (task as () => unknown) : () => task);
    },
  };
});

// LEDGER (credits) and TRACKING (events) run in parallel with this spec:
// mocked here per the orchestrator's run rules, never re-stubbed. SECURITY
// (guardRequest) is mocked too, so its stub ("laisse tout passer") can't
// hide a guard-ordering bug.
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));
const debit = vi.fn();
const refund = vi.fn();
vi.mock("@/lib/dal/credits", () => ({ debit: (args: unknown) => debit(args), refund: (id: string) => refund(id) }));
const track = vi.fn();
vi.mock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
const guardRequest = vi.fn();
vi.mock("@/lib/security", () => ({ guardRequest: (kind: string) => guardRequest(kind) }));

afterEach(() => {
  cookieStore.get.mockReturnValue(undefined);
  cookieStore.set.mockClear();
  testHeaders = new Headers();
  afterCallbacks.length = 0;
  getSession.mockReset();
  debit.mockReset().mockResolvedValue({ ok: true, balance: 9 });
  refund.mockReset();
  track.mockReset();
  guardRequest.mockReset().mockResolvedValue({ ok: true });
});

async function lettreProId(): Promise<string> {
  const row = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
  return row!.id;
}

const validInput = {
  poste: "Développeur Frontend",
  entreprise: "Dotworld",
  experience: "3 ans en React et TypeScript, spécialisé UI/UX",
  ton: "dynamique",
};

function postRequest(body: unknown, headers?: Record<string, string>) {
  return new Request("https://msb.local/lettre-pro/api/generate", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

function ctx(app = "lettre-pro") {
  return { params: Promise.resolve({ app }) };
}

/** Reads the whole SSE body, extracting the concatenated text-delta chunks. */
async function readTextDeltas(response: Response): Promise<string> {
  const raw = await response.text();
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice("data: ".length);
    if (payload === "[DONE]") continue;
    const chunk = JSON.parse(payload) as { type: string; delta?: string };
    if (chunk.type === "text-delta" && chunk.delta) text += chunk.delta;
  }
  return text;
}

/** Runs and awaits every after() callback collected so far, then clears them. */
async function flushAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

/** A promise plus its own resolve/reject, for controlling when a mock settles. */
function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function cleanupGeneration(idempotencyKey: string): Promise<void> {
  await db.delete(generations).where(eq(generations.idempotencyKey, idempotencyKey));
}

describe("POST [app]/api/generate — rejections before any write", () => {
  it("404s for an unknown slug, without calling debit", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ input: validInput, idempotencyKey: randomUUID() }),
      ctx("no-such-product"),
    );
    expect(response.status).toBe(404);
    expect(debit).not.toHaveBeenCalled();
  });

  it("404s for a killed product", async () => {
    // No killed product is seeded (docs/01: only lettre-pro, in "scale");
    // route with an unseeded-but-plausible slug exercises the same notFound
    // branch as a killed product would (both come from `!product`).
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(
      postRequest({ input: validInput, idempotencyKey: randomUUID() }),
      ctx("killed-product"),
    );
    expect(response.status).toBe(404);
  });

  it("400s on invalid JSON", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(postRequest("{not json"), ctx());
    expect(response.status).toBe(400);
    expect(debit).not.toHaveBeenCalled();
  });

  it("400s when generateInputSchema rejects the body (missing idempotencyKey)", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput }), ctx());
    expect(response.status).toBe(400);
  });

  it("400s with fieldErrors when a required tool field is missing", async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import("./route");
    const { entreprise, experience, ton } = validInput;
    const response = await POST(
      postRequest({ input: { entreprise, experience, ton }, idempotencyKey: randomUUID() }),
      ctx(),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors).toEqual({ poste: "required" });
    expect(debit).not.toHaveBeenCalled();
  });
});

describe("POST [app]/api/generate — guard", () => {
  it("429s when guardRequest reports rate_limited, before debit", async () => {
    getSession.mockResolvedValue({ user: { id: "someone" } });
    guardRequest.mockResolvedValue({ ok: false, reason: "rate_limited" });
    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey: randomUUID() }), ctx());
    expect(response.status).toBe(429);
    expect(guardRequest).toHaveBeenCalledWith("generate");
    expect(debit).not.toHaveBeenCalled();
  });

  it("403s when guardRequest reports bot", async () => {
    getSession.mockResolvedValue(null);
    guardRequest.mockResolvedValue({ ok: false, reason: "bot" });
    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey: randomUUID() }), ctx());
    expect(response.status).toBe(403);
  });
});

describe("POST [app]/api/generate — logged-in happy path", () => {
  it("streams the fixture text, saves the generation and tracks it", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());

    expect(response.status).toBe(200);
    const generationId = response.headers.get("x-generation-id");
    expect(generationId).toBeTruthy();

    expect(await readTextDeltas(response)).not.toBe("");
    await flushAfterCallbacks();

    await vi.waitFor(async () => {
      const row = await db.query.generations.findFirst({ where: eq(generations.id, generationId!) });
      expect(row?.status).toBe("succeeded");
      expect(row?.model).toBe("anthropic/claude-haiku-4.5");
      expect(row?.inputTokens).toBe(210);
      expect(row?.costMicros).toBe(910);
    });

    expect(debit).toHaveBeenCalledWith({
      userId: user!.id,
      productId: await lettreProId(),
      cost: 1,
      generationId,
      idempotencyKey,
    });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "generation", metadata: { generationId } }));

    await cleanupGeneration(idempotencyKey);
  });

  it("tracks first_generation only for the caller's first generation on this product", async () => {
    const user = await db.query.users.findFirst({ where: eq(users.email, "owner@msb.local") });
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const firstKey = randomUUID();
    const secondKey = randomUUID();

    const { POST } = await import("./route");
    const firstResponse = await POST(postRequest({ input: validInput, idempotencyKey: firstKey }), ctx());
    await readTextDeltas(firstResponse);
    await flushAfterCallbacks();
    await vi.waitFor(() => expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "first_generation" })));
    track.mockClear();

    const secondResponse = await POST(postRequest({ input: validInput, idempotencyKey: secondKey }), ctx());
    await readTextDeltas(secondResponse);
    await flushAfterCallbacks();
    await vi.waitFor(() => expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "generation" })));
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: "first_generation" }));

    await cleanupGeneration(firstKey);
    await cleanupGeneration(secondKey);
  });

  it("the tracking after() task waits for track() to settle before resolving", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const trackCall = deferred<void>();
    track.mockReturnValue(trackCall.promise);
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    await readTextDeltas(response);
    // saveGeneration's after() (the tracking task) is registered from
    // onSuccess, itself only invoked once the stream is fully drained above.
    await vi.waitFor(() => expect(afterCallbacks.length).toBeGreaterThanOrEqual(2));
    const trackingTask = afterCallbacks.at(-1)!;

    let settled = false;
    const taskPromise = Promise.resolve(trackingTask()).then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false); // still pending: the task must not resolve before track() does

    trackCall.resolve();
    await taskPromise;
    expect(settled).toBe(true);

    await cleanupGeneration(idempotencyKey);
  });

  it("a rejecting track() surfaces as a rejected after() task, never swallowed", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    track.mockRejectedValue(new Error("track down"));
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    await readTextDeltas(response);
    await vi.waitFor(() => expect(afterCallbacks.length).toBeGreaterThanOrEqual(2));
    const trackingTask = afterCallbacks.at(-1)!;

    await expect(Promise.resolve(trackingTask())).rejects.toThrow("track down");

    await cleanupGeneration(idempotencyKey);
  });
});

describe("POST [app]/api/generate — logged-in AI failure", () => {
  it("a mid-stream error: markGenerationFailed then refund once, row failed, no generation event, error chunk in the stream", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const failingModel = await import("@/lib/ai/model");
    // mockImplementationOnce (not mockReturnValue, which would leak into
    // every later test's resolveModel call): this spy is never restored
    // explicitly, so a persistent implementation would bleed across tests.
    vi.spyOn(failingModel, "resolveModel").mockImplementationOnce(
      () =>
        new MockLanguageModelV4({
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
        }),
    );
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(response.status).toBe(200);
    const raw = await response.text();
    expect(raw).toContain('"type":"error"');
    expect(raw).toContain("generation_failed");
    await flushAfterCallbacks();

    await vi.waitFor(() => expect(refund).toHaveBeenCalledTimes(1));
    expect(refund).toHaveBeenCalledWith(response.headers.get("x-generation-id"));
    // markGenerationFailed ran before refund (LEDGER's refund() only
    // refunds a `failed` generation): asserting the row is `failed` proves
    // markGenerationFailed committed, and it can only have committed before
    // refund resolved since onError awaits it first.
    const row = await db.query.generations.findFirst({ where: eq(generations.idempotencyKey, idempotencyKey) });
    expect(row?.status).toBe("failed");
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: "generation" }));
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: "first_generation" }));

    await cleanupGeneration(idempotencyKey);
  });

  it("a synchronous failure: 502 with refunded: true, markGenerationFailed then refund once, row failed", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const failingModel = await import("@/lib/ai/model");
    vi.spyOn(failingModel, "resolveModel").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: "generation_failed", refunded: true });

    expect(refund).toHaveBeenCalledTimes(1);
    const row = await db.query.generations.findFirst({ where: eq(generations.idempotencyKey, idempotencyKey) });
    expect(row?.status).toBe("failed");
    expect(track).not.toHaveBeenCalledWith(expect.objectContaining({ type: "generation" }));

    await cleanupGeneration(idempotencyKey);
  });
});

describe("POST [app]/api/generate — insufficient balance", () => {
  it("402s, records credits_exhausted and leaves the row failed, without refund", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    debit.mockResolvedValue({ ok: false, reason: "insufficient_balance" });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(response.status).toBe(402);
    await flushAfterCallbacks();

    expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "credits_exhausted" }));
    expect(refund).not.toHaveBeenCalled();

    const row = await db.query.generations.findFirst({ where: eq(generations.idempotencyKey, idempotencyKey) });
    expect(row?.status).toBe("failed");
    await cleanupGeneration(idempotencyKey);
  });
});

describe("POST [app]/api/generate — replay", () => {
  it("409s a second request with the same idempotency key, without a second debit", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const first = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    await readTextDeltas(first);
    await flushAfterCallbacks();

    const second = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(second.status).toBe(409);
    expect(debit).toHaveBeenCalledTimes(1);

    const rows = await db.select().from(generations).where(eq(generations.idempotencyKey, idempotencyKey));
    expect(rows).toHaveLength(1);
    await cleanupGeneration(idempotencyKey);
  });

  it("409s when debit itself reports a replay", async () => {
    const user = await db.query.users.findFirst();
    getSession.mockResolvedValue({ user: { id: user!.id } });
    debit.mockResolvedValue({ ok: true, replay: true });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(response.status).toBe(409);
    await cleanupGeneration(idempotencyKey);
  });
});

// A random, distinct IP per test (run rule: tests use random IPs and clean
// up): the route falls back to "unknown" without an x-forwarded-for
// header, which would otherwise let two anonymous tests collide on the
// same ipHash and see each other's prior generations.
function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `203.0.${octet()}.${octet()}`;
}

describe("POST [app]/api/generate — anonymous", () => {
  it("sets a new anonymous_id cookie and never debits", async () => {
    getSession.mockResolvedValue(null);
    testHeaders = new Headers({ "x-forwarded-for": randomIp() });
    cookieStore.get.mockReturnValue(undefined);
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const response = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(response.status).toBe(200);
    await readTextDeltas(response);

    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "anonymous_id", httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(response.headers.get("x-free-generations-left")).toBe("0");
    expect(debit).not.toHaveBeenCalled();

    const row = await db.query.generations.findFirst({ where: eq(generations.idempotencyKey, idempotencyKey) });
    expect(row?.userId).toBeNull();
    expect(row?.ipHash).toBeTruthy();
    await cleanupGeneration(idempotencyKey);
  });

  it("401s a second anonymous generation from the same cookie", async () => {
    getSession.mockResolvedValue(null);
    testHeaders = new Headers({ "x-forwarded-for": randomIp() });
    const anonymousId = randomUUID();
    cookieStore.get.mockReturnValue({ value: anonymousId });
    const firstKey = randomUUID();

    const { POST } = await import("./route");
    const first = await POST(postRequest({ input: validInput, idempotencyKey: firstKey }), ctx());
    await readTextDeltas(first);
    expect(cookieStore.set).not.toHaveBeenCalled();

    const second = await POST(postRequest({ input: validInput, idempotencyKey: randomUUID() }), ctx());
    expect(second.status).toBe(401);

    await cleanupGeneration(firstKey);
  });

  it("401s a new cookie from the same IP as a prior anonymous generation", async () => {
    getSession.mockResolvedValue(null);
    testHeaders = new Headers({ "x-forwarded-for": randomIp() });
    cookieStore.get.mockReturnValue(undefined);
    const firstKey = randomUUID();

    const { POST } = await import("./route");
    const first = await POST(postRequest({ input: validInput, idempotencyKey: firstKey }), ctx());
    await readTextDeltas(first);

    cookieStore.get.mockReturnValue(undefined); // a fresh visitor, no cookie yet, same IP
    const second = await POST(postRequest({ input: validInput, idempotencyKey: randomUUID() }), ctx());
    expect(second.status).toBe(401);

    await cleanupGeneration(firstKey);
  });

  it("a failed anonymous generation does not use up the free try", async () => {
    getSession.mockResolvedValue(null);
    testHeaders = new Headers({ "x-forwarded-for": randomIp() });
    cookieStore.get.mockReturnValue(undefined);
    const failingModel = await import("@/lib/ai/model");
    vi.spyOn(failingModel, "resolveModel").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const idempotencyKey = randomUUID();

    const { POST } = await import("./route");
    const first = await POST(postRequest({ input: validInput, idempotencyKey }), ctx());
    expect(first.status).toBe(502);

    // Root cause of a one-off cross-test collision (reproduced by running
    // this file in a loop: 15 runs left ~15 real, un-cleaned-up generation
    // rows for lettre-pro behind): this second call's key used to be an
    // inline `randomUUID()`, never captured, so `cleanupGeneration` below
    // could only ever delete the *first* call's row. Every run of this test
    // permanently leaked one real `hashIp(x-forwarded-for)`-derived row into
    // this worktree's persistent Postgres DB (never reset between `pnpm
    // test` invocations). `randomIp()`'s range is only 254*254 ≈ 64k
    // combinations, so as leaked rows accumulated across many runs, another
    // anonymous test's freshly random IP eventually collided with one of
    // them by chance, and `recordAnonymousGeneration`'s prior-row lookup
    // (matches on `anonymousId OR ipHash`) refused it with 401
    // `signup_required` even though it was a brand-new visitor — exactly
    // the observed flake in "sets a new anonymous_id cookie and never
    // debits". Capture and clean up both keys.
    const secondKey = randomUUID();
    const second = await POST(postRequest({ input: validInput, idempotencyKey: secondKey }), ctx());
    expect(second.status).toBe(200);
    await readTextDeltas(second);

    const rows = await db.select().from(generations).where(eq(generations.idempotencyKey, idempotencyKey));
    expect(rows[0]?.status).toBe("failed");
    await cleanupGeneration(idempotencyKey);
    await cleanupGeneration(secondKey);
  });
});
