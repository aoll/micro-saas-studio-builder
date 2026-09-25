import "server-only";

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
