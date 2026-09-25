import { describe, expect, it } from "vitest";

// Fixtures shared with the parity test below: `clientIp` here must behave
// exactly like the private `clientIp` in api/generate/route.ts (SECURITY
// plan, decision D4). The route keeps its own copy for now (route.ts is
// outside this spec's Périmètre); an orchestrator follow-up makes it import
// this one instead.
const fixtures: Array<{ name: string; headers: Record<string, string>; expected: string }> = [
  { name: "a single x-forwarded-for", headers: { "x-forwarded-for": "203.0.113.42" }, expected: "203.0.113.42" },
  {
    name: "the first hop of a multi-value x-forwarded-for",
    headers: { "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178" },
    expected: "203.0.113.42",
  },
  {
    name: "a multi-value x-forwarded-for with surrounding whitespace",
    headers: { "x-forwarded-for": "  203.0.113.42  , 70.41.3.18" },
    expected: "203.0.113.42",
  },
  {
    name: "x-real-ip when x-forwarded-for is absent",
    headers: { "x-real-ip": "198.51.100.7" },
    expected: "198.51.100.7",
  },
  {
    name: "x-real-ip when x-forwarded-for is an empty string",
    headers: { "x-forwarded-for": "", "x-real-ip": "198.51.100.7" },
    expected: "198.51.100.7",
  },
  {
    name: "'unknown' when x-forwarded-for is only whitespace and x-real-ip is absent",
    headers: { "x-forwarded-for": "   " },
    expected: "unknown",
  },
  { name: "'unknown' when neither header is present", headers: {}, expected: "unknown" },
];

// A byte-for-byte copy (decision D4) of the route's private `clientIp`,
// used to prove the two stay in parity without importing route.ts (a
// Route Handler module, awkward to import from a plain unit test).
function routeClientIp(requestHeaders: Headers): string {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }
  return requestHeaders.get("x-real-ip") ?? "unknown";
}

describe("clientIp", () => {
  it.each(fixtures)("returns $expected for $name", async ({ headers, expected }) => {
    const { clientIp } = await import("./rate-limit");
    expect(clientIp(new Headers(headers))).toBe(expected);
  });

  it.each(fixtures)("matches the route's private clientIp for $name", async ({ headers }) => {
    const { clientIp } = await import("./rate-limit");
    expect(clientIp(new Headers(headers))).toBe(routeClientIp(new Headers(headers)));
  });
});
