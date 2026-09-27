import "server-only";
import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { hashIp } from "@/lib/dal/generations";
import { getSession } from "@/lib/dal/session";
import { env } from "@/lib/env";
import { clientIp, isGenerationRateLimited } from "@/lib/rate-limit";

// Frozen contract (specs/CONTRACT-types.md): the request guard used by
// generation, signup and purchase, plus the "test the prompt" backoffice
// button (docs/04-nextjs.md, docs/06-vercel.md). V1 stub: "laisse tout
// passer" (docs/11's contract table), replaced here by SECURITY's real
// BotID (`checkBotId()`) and Postgres rate limit. Kinds: SA-02 `generate`,
// SA-03 `signup`, SA-05 `purchase`, BO-05's "Tester le prompt`
// `test-prompt`.
export type GuardKind = "generate" | "signup" | "purchase" | "test-prompt";

export type GuardResult = { ok: true } | { ok: false; reason: "bot" | "rate_limited" };

// No try/catch here (SECURITY plan, decision D5): a rejection from
// checkBotId or from the rate limiter's DAL call propagates as-is — neither
// fail-open (silently letting the request through) nor fail-closed
// (masking the real error as a guard rejection).
//
// BotID is enforced only on Vercel (env.VERCEL === "1", set automatically
// by the platform at build time and at runtime — never read from
// `process.env` directly here). Off Vercel — including a fully local
// `next build && next start` — checkBotId()'s real path requires a
// VERCEL_OIDC_TOKEN that only exists on an actual Vercel deployment, so it
// throws instead of classifying anything; forcing its own dev bypass there
// (`developmentOptions.isDevelopment: true`) makes it always return
// "human" instead. This fails open *only* for BotID, and only where BotID
// cannot work at all: the Postgres rate limit below still applies
// everywhere, on Vercel or not.
export const guardRequest: (kind: GuardKind) => Promise<GuardResult> = async (kind) => {
  const requestHeaders = await headers();
  if (!isQaBypass(requestHeaders)) {
    const bot = await checkBotId({ developmentOptions: { isDevelopment: env.VERCEL !== "1" } });
    if (bot.isBot) return { ok: false, reason: "bot" };
  }

  // Only `generate` is rate-limited (SECURITY plan, decision D1): the cost
  // that justifies a Postgres rate limit is the AI call it precedes.
  if (kind !== "generate") return { ok: true };

  const session = await getSession();
  const userId = session?.user.id ?? null;
  const ipHash = hashIp(clientIp(requestHeaders));
  const limited = await isGenerationRateLimited({ userId, ipHash });
  if (limited) return { ok: false, reason: "rate_limited" };

  return { ok: true };
};

// QA bypass (human decision, 2026-09-27): on a real Vercel deployment,
// checkBotId() correctly classifies a headless/automated QA browser as a
// bot (it has no way to tell that apart from a real one), which otherwise
// makes `generate`, `signup`, `purchase` and `test-prompt` untestable
// end-to-end against `preview`/`prod`. Off by default everywhere:
// QA_BYPASS_SECRET is only set in the environment for the duration of a QA
// pass, and even then only a caller who sends the exact matching header is
// exempted — every other caller, bots included, still goes through
// checkBotId() as before. Never skips the Postgres rate limit above.
function isQaBypass(requestHeaders: Headers): boolean {
  const secret = env.QA_BYPASS_SECRET;
  return secret !== undefined && requestHeaders.get("x-qa-bypass-secret") === secret;
}
