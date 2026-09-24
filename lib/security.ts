import "server-only";

// Frozen contract (specs/CONTRACT-types.md): the request guard used by
// generation, signup and purchase, plus the "test the prompt" backoffice
// button (docs/04-nextjs.md, docs/06-vercel.md). V1 stub, letting nothing
// through yet; SECURITY replaces it with BotID (`checkBotId()`) and the
// Postgres rate limit. Kinds: SA-02 `generate`, SA-03 `signup`, SA-05
// `purchase`, BO-05's "Tester le prompt" `test-prompt`.
export type GuardKind = "generate" | "signup" | "purchase" | "test-prompt";

export type GuardResult = { ok: true } | { ok: false; reason: "bot" | "rate_limited" };

export const guardRequest: (kind: GuardKind) => Promise<GuardResult> = async () => {
  throw new Error("not implemented");
};
