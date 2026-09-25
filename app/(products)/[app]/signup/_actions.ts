"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLatestMagicLink } from "@/lib/dal/magic-link";
import { getProduct } from "@/lib/dal/products";
import { slugSchema } from "@/lib/schemas/product-config";
import { signupInputSchema } from "@/lib/schemas/inputs";
import { guardRequest } from "@/lib/security";
import type { SignupState } from "./_state";

// SA-03 (specs/SA-03-inscription.md): the modal on the outil and the full
// page (page.tsx, @modal/(.)signup/page.tsx) both submit to this one
// action. `next/root-params` is unavailable in Server Actions
// (docs/04-nextjs.md), so the slug is bound with `.bind(null, slug)` by the
// caller, never read from form data. Its state type and initial value live
// in _state.ts: a "use server" file may only export async functions.

// The outbox stores the full absolute URL (docs/08-stack.md's simulated
// inbox); only the path and query are ever shown or followed client-side,
// so `BETTER_AUTH_URL` never has to match the origin actually serving the
// request (plan's risk table).
function toRelativeUrl(absoluteUrl: string): string {
  const url = new URL(absoluteUrl);
  return `${url.pathname}${url.search}`;
}

export async function requestMagicLink(
  slug: string,
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const slugResult = slugSchema.safeParse(slug);
  if (!slugResult.success) return { status: "error", error: "unexpected" };

  const parsed = signupInputSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", error: "invalid_email" };
  const { email } = parsed.data;

  const guard = await guardRequest("signup");
  if (!guard.ok) return { status: "error", error: guard.reason };

  const product = await getProduct(slugResult.data);
  if (!product || product.status === "killed") return { status: "error", error: "unexpected" };

  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: `/${product.slug}/signup/complete`,
        errorCallbackURL: `/${product.slug}/signup`,
      },
      headers: await headers(),
    });
  } catch (err) {
    // Better Auth's magic-link endpoint only ever resolves for a
    // well-formed email (already checked above), so a thrown error here is
    // an infrastructure failure, not a user mistake: logged with context,
    // same as admin/login's action, never surfaced as a stack trace.
    console.error("[signup] unexpected error while requesting a magic link", err);
    return { status: "error", error: "unexpected" };
  }

  // Read right after sending, for this email only (docs/08's simulated
  // inbox): admin/owner emails never get a row (lib/auth.ts's
  // sendMagicLink), so the inbox renders empty for them, same response
  // shape otherwise.
  const latest = await getLatestMagicLink(email);
  return { status: "sent", email, magicLinkUrl: latest ? toRelativeUrl(latest.url) : null };
}
