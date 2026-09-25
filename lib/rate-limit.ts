import "server-only";
import { env } from "@/lib/env";
import { countRecentGenerations } from "@/lib/dal/generations";

// A byte-for-byte copy (SECURITY plan, decision D4) of the private
// `clientIp` in api/generate/route.ts: `X-Forwarded-For` is only as
// trustworthy as whatever sits in front of Node (see that file's comment).
// The route keeps its own copy for now (route.ts is outside this spec's
// Périmètre); making it import this one instead is an orchestrator
// follow-up. A parity test (rate-limit.test.ts) proves the two agree.
export function clientIp(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return requestHeaders.get("x-real-ip") ?? "unknown";
}

export type RateLimitIdentity = { userId: string | null; ipHash: string };

// Postgres rate limit (specs/SECURITY.md): N generations per 60 s, per
// signed-in user and per ip_hash, N from lib/env.ts. Limited when either
// count reaches N (decision D2). `countRecentGenerations` already counts
// with a `>` window boundary on the database clock; the `>=` here (decision
// D3) means the guard, called before `recordGeneration`, refuses the
// (N+1)th request first — the Nth still gets through.
//
// Accepted race (security/DB review, LOW note 2): this is a plain
// count-then-insert, not serialized by a lock like
// `recordAnonymousGeneration`'s advisory lock. A burst of concurrent
// `generate` requests can each read the same "under the limit" count
// before any of their rows is written, so the limit can be exceeded
// briefly under real concurrency. Bounded, not a correctness bug: credits
// are still debited atomically (lib/dal/credits.ts's `debit`), so nobody
// generates for free, and the AI Gateway's own budget cap is the backstop
// against a determined burst.
export async function isGenerationRateLimited({ userId, ipHash }: RateLimitIdentity): Promise<boolean> {
  const { byUser, byIp } = await countRecentGenerations({ userId, ipHash, windowSeconds: 60 });
  const limit = env.GENERATION_RATE_LIMIT_PER_MINUTE;
  return (userId !== null && byUser >= limit) || byIp >= limit;
}
