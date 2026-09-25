import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { track } from "@/lib/dal/events";
import { getProduct } from "@/lib/dal/products";
import { trackEventInputSchema } from "@/lib/schemas/inputs";
import { slugSchema } from "@/lib/schemas/product-config";
import { ANONYMOUS_ID_COOKIE, anonymousIdCookie, readAnonymousId } from "./anonymous-id";

// The public endpoint `<TrackVisit>` beacons to (docs/04-nextjs.md): a
// static landing cannot call `track()` itself, so this Route Handler does
// it on the visitor's behalf, for the `visit` type only — every other
// event type is written server-side, from a Server Action or Route
// Handler that already has a session or a debited generation
// (specs/TRACKING.md, docs/04-nextjs.md: "n'accepte que les types d'events
// publics").
const MAX_BODY_BYTES = 2048;

function reject(status: number): NextResponse {
  return new NextResponse(null, { status });
}

// Reads the body without ever buffering more than `limit` bytes (+ one
// pending chunk): a declared `Content-Length` over the cap rejects before
// the stream is touched at all; otherwise the stream is read chunk by
// chunk and cancelled — not drained — the moment the running total crosses
// the cap. `await request.text()` alone would buffer a chunked body with no
// Content-Length in full before the length check ever ran.
async function readBodyWithLimit(
  request: NextRequest,
  limit: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > limit) return { ok: false };

  const body = request.body;
  if (!body) return { ok: true, text: "" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}

export async function POST(request: NextRequest, { params }: RouteContext<"/[app]/api/events">): Promise<NextResponse> {
  const bodyResult = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!bodyResult.ok) return reject(413);
  const rawBody = bodyResult.text;

  // sendBeacon never sets an Origin header for a same-origin request in
  // most browsers; when it is present, it must match (docs/04-nextjs.md's
  // security note applied to a POST endpoint with no auth to lean on).
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reject(403);

  const { app: slug } = await params;
  const slugResult = slugSchema.safeParse(slug);
  if (!slugResult.success) return reject(404);

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return reject(400);
  }

  const parsed = trackEventInputSchema.safeParse(json);
  if (!parsed.success) return reject(400);

  // Only `visit` is accepted from the client (docs/04-nextjs.md); every
  // other type would let anyone fabricate funnel steps.
  if (parsed.data.type !== "visit") return reject(403);

  const product = await getProduct(slugResult.data);
  if (!product || product.status === "killed") return reject(404);

  const existingCookie = readAnonymousId(request.cookies.get(ANONYMOUS_ID_COOKIE)?.value);
  const anonymousId = existingCookie ?? parsed.data.anonymousId;

  await track({
    type: parsed.data.type,
    productId: product.id,
    userId: null,
    anonymousId,
    metadata: parsed.data.metadata,
  });

  const response = new NextResponse(null, { status: 204 });
  if (!existingCookie) {
    const secure = request.nextUrl.protocol === "https:";
    response.cookies.set(anonymousIdCookie(anonymousId, secure));
  }
  return response;
}
