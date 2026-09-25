import "server-only";
import type { Route } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { grantSignupBonus } from "@/lib/dal/credits";
import { track } from "@/lib/dal/events";
import { getProduct } from "@/lib/dal/products";
import { getSession } from "@/lib/dal/session";
import { ANONYMOUS_ID_COOKIE, readAnonymousId } from "../../api/events/anonymous-id";

// SA-03 (specs/SA-03-inscription.md), plan step 3: Better Auth's magic-link
// `callbackURL` for this flow. It verifies the token, sets the session
// cookie itself (nextCookies plugin, lib/auth.ts), then redirects here
// (plain GET, no user-supplied body to validate). This handler only reads
// the now-established session, grants the signup bonus once
// (grantSignupBonus's own idempotency key, lib/dal/credits.ts) and tracks
// the event — both only after a session exists (plan's design decision 1:
// "Bonus and event only in complete/route.ts, after getSession()").
export async function GET(_request: Request, { params }: RouteContext<"/[app]/signup/complete">) {
  const { app: slug } = await params;
  const product = await getProduct(slug);
  if (!product || product.status === "killed") notFound();

  const session = await getSession();
  if (!session) redirect(`/${slug}/signup` as Route);

  await grantSignupBonus({ userId: session.user.id, productId: product.id });

  // The anonymous cookie set by a prior anonymous generation or visit
  // (docs/04-nextjs.md, shared with api/generate and api/events): a
  // tampered or missing cookie reads as null (readAnonymousId), never
  // thrown — signup still succeeds without it, just unlinked from an
  // anonymous_id (design decision 1).
  const cookieStore = await cookies();
  const anonymousId = readAnonymousId(cookieStore.get(ANONYMOUS_ID_COOKIE)?.value);
  const userId = session.user.id;

  after(async () => {
    await track({ type: "signup", productId: product.id, userId, anonymousId });
  });

  redirect(`/${slug}/tool` as Route);
}
