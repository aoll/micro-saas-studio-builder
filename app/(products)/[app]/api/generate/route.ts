import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { streamGeneration } from "@/lib/ai/generate";
import { debit, refund } from "@/lib/dal/credits";
import { track } from "@/lib/dal/events";
import {
  countPriorGenerations,
  findGenerationByKey,
  hashIp,
  markGenerationFailed,
  recordAnonymousGeneration,
  recordGeneration,
  saveGeneration,
} from "@/lib/dal/generations";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { generateInputSchema } from "@/lib/schemas/inputs";
import { guardRequest } from "@/lib/security";
import { ANONYMOUS_ID_COOKIE, anonymousIdCookie, readAnonymousId } from "../events/anonymous-id";
import { toolInputSchema } from "../../tool/_lib/tool-input-schema";

export const maxDuration = 60;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}

// Trust model (security review, SA-02): `x-forwarded-for` is only as
// trustworthy as whatever sits in front of Node. On Vercel, the edge
// network sets/overwrites this header itself, so a client cannot spoof it.
// Self-hosting (docs/06-vercel.md's Fly.io alternative) must have its own
// reverse proxy strip any inbound `X-Forwarded-For` before appending the
// real peer address — left to SECURITY's deployment hardening, out of this
// route's Périmètre.
function clientIp(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return requestHeaders.get("x-real-ip") ?? "unknown";
}

// POST [app]/api/generate (SA-02): Zod-validated input → guardRequest →
// identity (session, or anonymous cookie + IP) → recordGeneration (pending)
// → debit → streamText (lib/ai/generate.ts), streamed to the client. Success
// finalizes the row and tracks events in after(); failure marks it failed
// and refunds (docs/05-ia.md's sequence diagram).
export async function POST(request: Request, { params }: RouteContext<"/[app]/api/generate">) {
  const { app: slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status === "killed") return jsonError("not_found", 404);

  // Bonus per docs/01 (image output), out of this spec's Périmètre: refuse
  // cleanly rather than silently mis-handling it as markdown.
  if (product.generation.outputType === "image") return jsonError("unsupported_output_type", 501);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }
  const parsedBody = generateInputSchema.safeParse(body);
  if (!parsedBody.success) return jsonError("invalid_input", 400);
  const { input, idempotencyKey } = parsedBody.data;

  const fields = toolInputSchema(product.inputs, input);
  if (!fields.success) return jsonError("invalid_input", 400, { fieldErrors: fields.fieldErrors });

  // A replayed key is rejected before any guard or write: it can only be a
  // retry of a request that already ran once.
  if (await findGenerationByKey(idempotencyKey)) return jsonError("duplicate_request", 409);

  const guard = await guardRequest("generate");
  if (!guard.ok) return jsonError(guard.reason, guard.reason === "bot" ? 403 : 429);

  const session = await getSession();
  const userId = session?.user.id ?? null;

  const requestHeaders = await headers();
  const ipHash = hashIp(clientIp(requestHeaders));

  const cookieStore = await cookies();
  // Shared with TRACKING (api/events): same cookie name and shape, so a
  // visit and a generation from the same visitor agree on one anonymous id.
  const existingAnonymousId = userId ? null : readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);

  let generationId: string;
  let anonymousId: string | null = null;
  let freeGenerationsLeft: number | null = null;
  let isFirstGeneration: boolean;

  if (userId) {
    const priorCount = await countPriorGenerations({ productId: product.id, userId, anonymousId: null, ipHash: null });
    isFirstGeneration = priorCount === 0;
    const recorded = await recordGeneration({
      productId: product.id,
      productVersion: product.version,
      userId,
      anonymousId: null,
      ipHash,
      input: fields.data,
      idempotencyKey,
    });
    generationId = recorded.id;
  } else {
    // recordAnonymousGeneration counts and inserts atomically (security
    // review, MEDIUM): the separate count-then-insert this route used to do
    // let concurrent requests all pass the "under the limit" check.
    anonymousId = existingAnonymousId ?? randomUUID();
    const recorded = await recordAnonymousGeneration({
      productId: product.id,
      productVersion: product.version,
      anonymousId,
      ipHash,
      input: fields.data,
      idempotencyKey,
      limit: product.pricing.anonymousFreeGenerations,
    });
    if (!recorded.ok) return jsonError("signup_required", 401);
    generationId = recorded.id;
    freeGenerationsLeft = recorded.freeGenerationsLeft;
    isFirstGeneration = recorded.isFirst;
  }

  if (userId) {
    const debitResult = await debit({
      userId,
      productId: product.id,
      cost: product.pricing.costPerGeneration,
      generationId,
      idempotencyKey,
    });
    if (!debitResult.ok) {
      await markGenerationFailed(generationId);
      after(() => track({ type: "credits_exhausted", productId: product.id, userId, anonymousId: null }));
      return jsonError("insufficient_balance", 402);
    }
    if ("replay" in debitResult) return jsonError("duplicate_request", 409);
  }

  try {
    const result = streamGeneration({
      product,
      inputs: fields.data,
      onSuccess: async (generationResult) => {
        await saveGeneration(generationId, generationResult);
        after(() => {
          void track({
            type: "generation",
            productId: product.id,
            userId,
            anonymousId,
            metadata: { generationId },
          });
          if (isFirstGeneration) {
            void track({
              type: "first_generation",
              productId: product.id,
              userId,
              anonymousId,
              metadata: { generationId },
            });
          }
        });
      },
      onError: async (error) => {
        console.error(`[api/generate] generation ${generationId} failed`, error);
        await markGenerationFailed(generationId);
        if (userId) await refund(generationId);
      },
    });

    // Registered with after() (security review, HIGH), not just fired and
    // forgotten: after() extends the invocation's lifetime until this
    // promise settles, so onFinish/onError (and the save or the refund they
    // trigger) still run even if the client disconnects before the stream
    // ends — a bare `void result.consumeStream()` gave the platform no
    // signal to keep the invocation alive for that long. `Promise.resolve`
    // narrows `consumeStream()`'s `PromiseLike<void>` to the `Promise<void>`
    // `after()`'s `AfterTask` type requires.
    after(Promise.resolve(result.consumeStream()));

    const response = result.toUIMessageStreamResponse({
      onError: () => "generation_failed",
      headers: {
        "x-generation-id": generationId,
        ...(freeGenerationsLeft !== null ? { "x-free-generations-left": String(freeGenerationsLeft) } : {}),
      },
    });

    if (!userId && !existingAnonymousId && anonymousId) {
      const secure = new URL(request.url).protocol === "https:";
      cookieStore.set(anonymousIdCookie(anonymousId, secure));
    }

    return response;
  } catch (error) {
    // A synchronous failure before any byte streamed (e.g. model resolution):
    // the status code can still change, unlike an in-stream `error` part.
    console.error(`[api/generate] generation ${generationId} failed synchronously`, error);
    await markGenerationFailed(generationId);
    if (userId) await refund(generationId);
    return jsonError("generation_failed", 502, { refunded: Boolean(userId) });
  }
}
