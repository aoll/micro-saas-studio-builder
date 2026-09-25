# Plan: I18N-SEO · English and SEO

**Source spec**: specs/I18N-SEO.md
**Complexity**: Medium.
- One repo-wide fr/en guard test.
- Four metadata files: `app/robots.ts`, `app/sitemap.ts`, and `[app]/icon.tsx` + `[app]/opengraph-image.tsx`.
- One e2e file.
- No change to product code or `messages/*`.

## Summary

All 9 sub-app zones already exist in fr and en. This spec adds:
- `i18n/messages.test.ts`: same zone files, same key paths, same ICU arguments, en loads every zone, and every namespace the sub-app asks for exists in both locales;
- `robots.ts`: disallows `/admin$` and `/admin/`, and points to an absolute sitemap;
- `sitemap.ts`: the landings of non-killed products, from the cached `listProducts`;
- a 32×32 icon (initial on primary) and a 1200×630 OG image, both in the theme colours;
- `e2e/seo.spec.ts`: SEO checks, plus a full English sub-app journey with a denylist of fr strings.

## Orchestrator decisions (binding)

1. **Colocated tests are in scope** (B1): `app/robots.test.ts`, `app/sitemap.test.ts`, `app/(products)/[app]/icon.test.tsx` and `app/(products)/[app]/opengraph-image.test.tsx`. This follows the repo convention.
2. **Human decision (« go fichier partagé », 2026-09-25), replacing B2:** the Périmètre is extended to `app/(products)/[app]/_lib/og-colors.ts` + `og-colors.test.ts`. That file owns `drawable()` and the colour resolution (primary with branding override, onPrimary, background, foreground, mutedForeground from the light tokens). `icon.tsx` and `opengraph-image.tsx` import it, with no duplication.
3. **`metadataBase`, canonical, Open Graph title/description in `generateMetadata`, and `generateViewport` themeColor are out of scope** (they are not acceptance bullets and need `[app]/layout.tsx` / `page.tsx`). The orchestrator records them as a follow-up. The E2E test fetches images by path.
4. **Route Handlers.** Metadata image handlers read `{ params }`, never `next/root-params`, which does not work in Route Handlers. No `'use cache'` in the handler bodies: they read already-cached, tagged DAL functions. If the Phase 0 build needs it, add `generateStaticParams` inside the same files.
5. **Missing or killed product:** 404. **Missing theme row:** throw, as `layout.tsx` does. **Colours:** only `#hex`, `rgb()`/`rgba()` and `hsl()`/`hsla()` are drawable; anything else falls back. Light tokens only. The branding primary overrides the theme primary.
6. **Robots:** `disallow: ["/admin$", "/admin/"]`, so a slug such as `admin-xyz` is not blocked. **Sitemap base URL:** `env.BETTER_AUTH_URL` without its trailing slash, with a comment. No `lastModified`.
7. **Drift:** if the new guard finds fr/en drift in `messages/*`, report it; never loosen the test.
8. **No wait loops:** never write `until`/`while pgrep -f` loops. Run `pnpm check`, `pnpm test:coverage` and `flock /tmp/msb-queue/build.lock pnpm build` in the foreground.

## Tasks (red → green; commit and push each; `feat(app)` / `test(app)`)

0. **Spike (no commit):** add bare icon and OG stubs, run the build, check the route table and whether `generateStaticParams` is needed, then discard the stubs.
1. **`i18n/messages.test.ts`:** zones by locale, key paths with a readable diff, ICU arguments, `loadMessages("en")` zone set, and the namespace scan of `app/(products)` + `components/product`.
2. **`app/robots.ts`** and its test.
3. **`app/sitemap.ts`** and its test: test, learn and scale products are included, killed ones excluded, and an empty list gives an empty sitemap.
4. **`drawable()`** and the colour resolution, tested through the icon and OG tests.
5. **`[app]/icon.tsx`** and its test: mock `next/og` and the DAL, then check the colours, the initial, the size, 404 for killed and unknown products, and the throw on a missing theme.
6. **`[app]/opengraph-image.tsx`** and its test, with the same cases.
7. **`e2e/seo.spec.ts`**, written but not run:
   - robots and sitemap;
   - icon and OG image found through the `<link>` / `<meta>` tags, fetched by path, with pixel colours checked against the `themes` row;
   - an en product across 7 screens plus a killed-product 404, with `lang="en"` and the fr denylist;
   - cleanup in `finally`.
8. **Final checks.**

## Acceptance

- [ ] fr + en texts, and a test that en has exactly the fr keys: task 1
- [ ] A product with locale=en shows the whole sub-app in English: tasks 1 and 7
- [ ] `opengraph-image.tsx` and `icon.tsx` per product, in the theme colours: tasks 4–7
- [ ] `sitemap.ts` lists active products; `robots.ts` excludes `/admin`: tasks 2, 3 and 7
- [ ] `pnpm check` and the build are green; PR title `feat(app): I18N-SEO English guard, sitemap, robots, icon and OG images`
