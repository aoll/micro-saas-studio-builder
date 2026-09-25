import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// QA1-P2-N1: reproduced on a real dev server (RSC prefetch request to
// /admin/ops as the owner) before this fix — "Next.js encountered uncached
// data during prerendering or a navigation … `fetch(...)` or `connection()`
// accessed outside of `<Suspense>`", stack `requireAdmin` (lib/dal/session.ts)
// ← `OpsPage` (this file). getSession()/requireAdmin() read the session
// (io() + cookies()/headers(), lib/dal/session.ts), a request-time read that
// Cache Components refuses to prerender into the route's static shell unless
// it sits behind a <Suspense> boundary (node_modules/next/dist/docs/01-app/
// 02-guides/authentication-with-cache-components.md, "Step 2: Show the user
// without blocking the page"; io.md's own example wraps the caller in
// <Suspense>). Vitest can't render this async Server Component (docs/09 ›
// Vitest ne sait pas rendre les Server Components async), so this test is
// source-level like require-admin-coverage.test.ts: it locks the structure
// (sync default export, dynamic reads pushed into a component under
// <Suspense>), the dev-server repro above and e2e/admin-http-status.spec.ts +
// e2e/demo-mode.spec.ts cover the actual behaviour.
const source = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");

describe("app/(backoffice)/admin/ops/page.tsx — Cache Components shell", () => {
  it("imports Suspense from react", () => {
    expect(source).toMatch(/import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*["']react["']/);
  });

  it("the default export (OpsPage) is not itself async", () => {
    // A top-level `await` in the page's own function body — even before
    // the `return` — pulls that read out of the static shell for the whole
    // route (docs/04 › Rendu et cache; the authentication guide's own
    // "Page" example is a plain, non-async function for the same reason).
    expect(source).toMatch(/export default function OpsPage\s*\(/);
    expect(source).not.toMatch(/export default async function OpsPage/);
  });

  it("wraps the owner check and requireAdmin() in a <Suspense> boundary with a fallback", () => {
    expect(source).toMatch(/<Suspense\s+fallback=/);
  });

  it("getSession() and requireAdmin() are only called inside an async component, not at OpsPage's top level", () => {
    const defaultExportBody = source.slice(
      source.indexOf("export default function OpsPage"),
      source.indexOf("async function"),
    );
    expect(defaultExportBody).not.toMatch(/await\s+getSession\s*\(\s*\)/);
    expect(defaultExportBody).not.toMatch(/await\s+requireAdmin\s*\(\s*\)/);

    // require-admin-coverage.test.ts only checks these calls exist
    // somewhere in the file; this test pins them to the async gate.
    expect(source).toMatch(/await\s+getSession\s*\(\s*\)/);
    expect(source).toMatch(/await\s+requireAdmin\s*\(\s*\)/);
  });
});
