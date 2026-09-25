import { SignupFlow } from "./signup-flow";

// SA-03 (specs/SA-03-inscription.md), plan design decisions 5/8: the one
// async leaf of signup/page.tsx, kept under <Suspense> so awaiting
// `searchParams` (Cache Components: a dynamic input) does not cost the
// rest of the page its shell. Any `error` query param — Better Auth's
// magic-link verify redirects here with `?error=INVALID_TOKEN` for both an
// expired and an already-used token — collapses to the same "expired"
// message; Better Auth's own error text or code is never shown.
export async function SignupPanel({
  slug,
  freeCreditsOnSignup,
  searchParams,
}: {
  slug: string;
  freeCreditsOnSignup: number;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const expired = typeof params.error === "string";

  return <SignupFlow slug={slug} freeCreditsOnSignup={freeCreditsOnSignup} expired={expired} />;
}
