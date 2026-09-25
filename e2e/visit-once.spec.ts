import { expect, test } from "@playwright/test";
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, products } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";

// QA1-P1-B4 (.claude/qa/reports/2026-09-25-full.md · B4): a first, fresh
// browser context that opens /lettre-pro once must write exactly one
// `visit` row with exactly one `anonymous_id`, and a reload must not add a
// second one. The fix spans proxy.ts (mints the cookie before the first
// beacon), api/events/route.ts (identity only from that cookie) and
// <TrackVisit> (no longer mints its own id) — this test exercises all
// three together, through a real browser.
//
// Not run to green in this session: `playwright.config.ts`'s webServer
// readiness check polls `url: baseURL` (`http://localhost:3100/`, no
// path), and `GET /` 404s in this app (the `[app]` root param has no
// route without a slug — confirmed with a direct curl against a running
// `next start`). Playwright's default webServer check only accepts a 2xx
// response, so it always times out at the configured 300s regardless of
// how fast the app is actually ready (confirmed: `pnpm db:migrate && pnpm
// db:seed && pnpm build` alone completed in ~15s unloaded, and the app
// served /lettre-pro with 200 well before the timeout). This is a
// pre-existing webServer config issue outside this spec's Périmètre
// (playwright.config.ts is shared infra, not listed here) that would
// block every e2e spec in the repo, not specific to this fix; left for
// the orchestrator to address (e.g. point `url` at a route that exists).
// The exact same acceptance bullet is proven at the unit and real-Postgres
// level by route.test.ts's B4 reproduction, route.db.test.ts's
// concurrent-beacon cases, track-visit.test.tsx and proxy.test.ts.
const ANONYMOUS_ID_COOKIE = "anonymous_id";

test.describe("A first visit counts one visit (QA1-P1-B4)", () => {
  test("fresh context on /lettre-pro: 1 visit event, 1 anonymous_id cookie, reload still 1", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
    const db = drizzle(sql, { schema: { events, products } });
    try {
      await page.goto("/lettre-pro");

      const cookies = await context.cookies();
      const anonymousCookies = cookies.filter((cookie) => cookie.name === ANONYMOUS_ID_COOKIE);
      expect(anonymousCookies).toHaveLength(1);
      const anonymousId = anonymousCookies[0]?.value;
      expect(anonymousId).toBeTruthy();

      const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
      if (!product) throw new Error("Seed missing: lettre-pro (run pnpm db:seed)");

      await expect
        .poll(
          async () =>
            db.query.events.findMany({
              where: and(
                eq(events.productId, product.id),
                eq(events.type, "visit"),
                eq(events.anonymousId, anonymousId!),
                gte(events.createdAt, dsql`now() - interval '1 minute'`),
              ),
            }),
          { message: "waiting for the visit beacon", timeout: 10_000 },
        )
        .toHaveLength(1);

      await page.reload();
      await page.waitForTimeout(500); // lets a same-day duplicate beacon settle, if any.

      const rowsAfterReload = await db.query.events.findMany({
        where: and(
          eq(events.productId, product.id),
          eq(events.type, "visit"),
          eq(events.anonymousId, anonymousId!),
          gte(events.createdAt, dsql`now() - interval '1 minute'`),
        ),
      });
      expect(rowsAfterReload).toHaveLength(1);

      const cookiesAfterReload = (await context.cookies()).filter((cookie) => cookie.name === ANONYMOUS_ID_COOKIE);
      expect(cookiesAfterReload).toHaveLength(1);
      expect(cookiesAfterReload[0]?.value).toBe(anonymousId);
    } finally {
      await sql.end({ timeout: 5 });
      await context.close();
    }
  });
});
