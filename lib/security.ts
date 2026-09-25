import "server-only";
import { checkBotId } from "botid/server";

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
// checkBotId (or, once wired, the rate limiter's DAL call) propagates as-is
// — neither fail-open (silently letting the request through) nor
// fail-closed (masking the real error as a guard rejection).
export const guardRequest: (kind: GuardKind) => Promise<GuardResult> = async () => {
  const bot = await checkBotId();
  if (bot.isBot) return { ok: false, reason: "bot" };

  return { ok: true };
};
