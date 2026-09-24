# Arborescence du repo

## Principes d'organisation

La doc Next.js 16.3 le dit d'entrée : le framework est **« unopinionated »** sur l'organisation, la seule règle est de choisir une stratégie et de s'y tenir. Voici celle retenue et pourquoi.

- **Stratégie « split by feature or route »** (l'une des trois proposées par la doc) : `app/` porte le routing et le code propre à une route, colocalisé dans des dossiers privés `_components/` ; le code partagé vit à la racine dans `lib/` et `components/`.
- **Pas de dossier `src/`** : le repo compte beaucoup de fichiers de config (Drizzle, Playwright, Vitest, shadcn, Vercel), et `src/` les séparerait bien du code. Mais tous les chemins déjà écrits dans ce dossier (`lib/dal/…`, `proxy.ts`) sont sans `src/`, on garde donc la version la plus simple. Si on bascule plus tard : `proxy.ts` et `instrumentation*.ts` passent dans `src/`, alors que `public/`, `.env*` et les configs restent à la racine.
- **Deux root layouts, zéro `app/layout.tsx`** : les route groups `(backoffice)` et `(products)` ont chacun leur `layout.tsx` avec `<html>` et `<body>`. C'est le cas « multiple root layouts » de la doc : le backoffice et les produits n'ont ni la même UI, ni le même thème, ni la même locale.
- **La colocation est sûre** : un dossier de `app/` ne devient public que s'il contient `page` ou `route`. Les dossiers `_prefixés` sortent du routing, eux et tous leurs sous-dossiers. On en profite pour trier les fichiers dans l'éditeur et pour éviter les conflits avec de futures conventions Next.js.
- **Deux pièges relevés en lisant la doc** :
  - La page cachée `/admin/_ops` prévue plus haut **ne serait pas routable**, puisque `_ops` est un dossier privé. On la renomme `admin/ops/` : elle reste « cachée » parce qu'aucun lien n'y mène et qu'elle est réservée au rôle `owner`. `%5Fops` marcherait aussi, mais c'est moins lisible.
  - `[app]` capte tout segment de premier niveau, il faut donc **réserver des slugs** (`admin`, `api`, et les noms des fichiers de `public/`) dans le schéma Zod de création produit. Côté Next, les segments statiques gagnent sur le dynamique, donc aucun conflit de route ; en revanche un produit nommé `admin` serait inatteignable.

## Arborescence complète

L'arbre ci-dessous reprend le routing des onglets Produit et Next.js, et ajoute les fichiers imposés par les libs (détaillés dans la section suivante).

```
micro-saas-studio-builder/
├── app/
│   ├── (backoffice)/
│   │   ├── layout.tsx                 # root layout BO : <html>, globals.css, <Toaster/>
│   │   └── admin/
│   │       ├── page.tsx               # portefeuille (Test / Learn / Scale / Killed)
│   │       ├── loading.tsx
│   │       ├── _components/           # portefeuille : tables, charts Recharts
│   │       ├── login/page.tsx         # BO-01 (hors requireAdmin)
│   │       ├── products/
│   │       │   ├── _actions.ts        # créer, enregistrer, tester, publier (BO-05)
│   │       │   ├── _components/       # formulaire produit (BO-05)
│   │       │   ├── new/page.tsx       # BO-05 création
│   │       │   └── [slug]/
│   │       │       ├── _actions.ts    # changement de statut (BO-06)
│   │       │       ├── _components/   # fiche, funnel, modale de statut
│   │       │       ├── page.tsx       # fiche produit + métriques
│   │       │       ├── edit/page.tsx  # BO-05 édition
│   │       │       └── activity/page.tsx
│   │       ├── themes/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx      # BO-08
│   │       ├── settings/              # BO-09 : page.tsx, _actions.ts, _components/
│   │       └── ops/page.tsx           # reset démo, rôle owner (pas « _ops » : privé = non routable)
│   ├── (products)/
│   │   └── [app]/                     # root param → next/root-params
│   │       ├── layout.tsx             # root layout produit : thème, locale, slot @modal
│   │       ├── page.tsx               # landing statique (generateStaticParams ≥ 1)
│   │       ├── not-found.tsx
│   │       ├── opengraph-image.tsx
│   │       ├── icon.tsx
│   │       ├── _components/           # landing et composants partagés du produit
│   │       ├── tool/page.tsx
│   │       ├── history/page.tsx
│   │       ├── account/page.tsx           # SA-07 compte et crédits
│   │       ├── pricing/page.tsx
│   │       ├── checkout/
│   │       │   ├── _actions.ts        # purchase()
│   │       │   ├── _components/       # formulaire de paiement (page et modale)
│   │       │   └── [packId]/page.tsx  # version pleine page (lien direct / refresh)
│   │       ├── signup/                # page.tsx, _actions.ts (lien magique), _components/
│   │       ├── @modal/
│   │       │   ├── default.tsx        # return null
│   │       │   ├── [...catchAll]/page.tsx
│   │       │   ├── (.)checkout/[packId]/page.tsx
│   │       │   ├── (.)pricing/page.tsx
│   │       │   └── (.)signup/page.tsx
│   │       └── api/
│   │           ├── generate/route.ts  # streamText + débit crédits
│   │           └── events/route.ts    # sendBeacon de <TrackVisit>
│   ├── api/
│   │   ├── auth/[...all]/route.ts     # Better Auth (toNextJsHandler)
│   │   └── cron/reset-demo/route.ts   # bonus : Vercel Cron, vérifie CRON_SECRET
│   ├── globals.css                    # Tailwind v4 + variables shadcn, importé par les 2 layouts
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── ui/                            # composants shadcn (générés par `shadcn add`)
│   ├── shared/                        # partagé BO + produits (Logo, Markdown…)
│   └── track-visit.tsx                # sendBeacon → api/events
├── lib/
│   ├── auth.ts                        # betterAuth({ drizzleAdapter, magicLink, nextCookies })
│   ├── auth-client.ts                 # createAuthClient() — seul fichier auth côté client
│   ├── db/
│   │   ├── index.ts                   # drizzle(postgres(DATABASE_URL))
│   │   ├── schema.ts                  # tables métier
│   │   └── auth-schema.ts             # tables Better Auth (générées par la CLI)
│   ├── dal/                           # seul accès à `db` — import 'server-only'
│   │   ├── credits.ts                 # ledger
│   │   ├── products.ts                # lecture (getProduct, listProducts)
│   │   ├── product-editor.ts          # création, versions, publication
│   │   ├── product-status.ts          # changement de statut
│   │   ├── themes.ts
│   │   ├── generations.ts             # recordGeneration, markGenerationFailed
│   │   ├── history.ts                 # listGenerations
│   │   ├── events.ts                  # track()
│   │   ├── metrics.ts                 # funnel, portefeuille
│   │   ├── activity.ts
│   │   ├── thresholds.ts              # seuils de décision
│   │   ├── guards.ts                  # assertEditable, isEditable (mode démo)
│   │   └── session.ts
│   ├── ai/
│   │   ├── model.ts                   # AI_MODE mock | live, Gateway + fallbacks
│   │   ├── prompt.ts                  # renderPrompt()
│   │   └── generate.ts
│   ├── decision.ts                    # evaluate(metrics, thresholds), fonction pure
│   ├── schemas/                       # Zod partagés form ↔ action ↔ API
│   ├── security.ts                    # guardRequest(kind) : BotID + rate limit
│   ├── rate-limit.ts                  # rate limit Postgres
│   ├── env.ts                         # variables validées (t3-env), importé par next.config.ts
│   ├── fonts.ts                       # next/font
│   └── utils.ts                       # cn() — créé par shadcn init
├── i18n/
│   └── request.ts                     # getRequestConfig → locale depuis la config produit
├── messages/                          # un fichier par zone, fusionnés dans i18n/request.ts
│   ├── fr/ (common.json, tool.json, pricing.json, checkout.json…)
│   └── en/ (mêmes fichiers, mêmes clés)
├── drizzle/                           # migrations SQL générées (commitées)
├── fixtures/                          # {slug}.json — réponses IA enregistrées, relues par le seed
├── scripts/
│   ├── seed.ts
│   ├── reset-demo.ts                  # appelé par /admin/ops
│   ├── record-fixtures.ts
│   └── method-stats.ts                # chiffres de la méthode pour le README
├── specs/                             # une spec par feature (onglet Specs)
│   └── mockups/                       # maquettes BO-xx, SA-xx
├── docs/                              # export markdown de ce dossier, lu par les agents
├── .github/
│   └── pull_request_template.md
├── .husky/                            # pre-commit (lint-staged)
├── .claude/settings.json              # hooks Claude Code
├── .vscode/                           # extensions et settings recommandés
├── e2e/                               # Playwright (*.spec.ts) + instant()
├── public/
├── proxy.ts                           # bonus sous-domaines
├── instrumentation.ts                 # @ai-sdk/otel
├── instrumentation-client.ts          # initBotId()
├── next.config.ts                     # flags 16.3 + withBotId + withNextIntl
├── drizzle.config.ts
├── components.json                    # config shadcn
├── vitest.config.mts
├── playwright.config.ts
├── vercel.json                        # crons (bonus)
├── eslint.config.mjs
├── tsconfig.json                      # alias @/*
├── .lintstagedrc.js
├── .nvmrc                             # Node 22
├── .editorconfig
├── .env.example                       # les 8 variables, sans valeurs
├── .mcp.json                          # next-devtools-mcp
├── AGENTS.md                          # géré par next dev
├── CLAUDE.md
└── package.json
```

## Fichiers imposés par chaque librairie

| Fichier | Lib | Rôle | Source |
| --- | --- | --- | --- |
| `app/**/page`, `layout`, `loading`, `not-found`, `route`, `default` | Next.js | Conventions de routing (noms fixes) | [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) |
| `opengraph-image.tsx`, `icon.tsx`, `sitemap.ts`, `robots.ts` | Next.js | Metadata générées par le code | idem |
| `proxy.ts` | Next.js | Ex-middleware, à la racine (ou dans `src/`) | [src folder](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder) |
| `instrumentation.ts` / `instrumentation-client.ts` | Next.js | OTel serveur / init client (BotID) | [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) |
| `lib/auth.ts` | Better Auth | Instance serveur ; plugin `nextCookies()` **en dernier** pour que les Server Actions posent les cookies | [Better Auth × Next](https://www.better-auth.com/docs/integrations/next) |
| `lib/auth-client.ts` | Better Auth | `createAuthClient()` (from `better-auth/react`) | idem |
| `app/api/auth/[...all]/route.ts` | Better Auth | `export const { GET, POST } = toNextJsHandler(auth)` | idem |
| `lib/db/auth-schema.ts` | Better Auth | Tables user / session / verification, générées par `npx auth@latest generate` puis migrées par drizzle-kit | [Adapter Drizzle](https://www.better-auth.com/docs/adapters/drizzle) |
| `drizzle.config.ts` | Drizzle | `schema`, `out: './drizzle'`, `dialect: 'postgresql'`, `dbCredentials.url` | [Get started Postgres](https://orm.drizzle.team/docs/get-started/postgresql-new) |
| `drizzle/` | Drizzle | Migrations SQL (`drizzle-kit generate` → `migrate`) | idem |
| `i18n/request.ts` | next-intl | `getRequestConfig()` : locale + messages, relié par le plugin | [next-intl sans routing i18n](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing) |
| `messages/{locale}.json` | next-intl | Traductions, clés par namespace | idem |
| `next.config.ts` | next-intl + BotID | `withNextIntl(withBotId(config))` | idem + BotID |
| `components.json` | shadcn | Config de la CLI (style, alias) | [shadcn × Next](https://ui.shadcn.com/docs/installation/next) |
| `components/ui/`, `lib/utils.ts`, `app/globals.css` | shadcn | Composants copiés, `cn()`, variables de thème Tailwind v4 | idem |
| `vitest.config.mts` | Vitest | `plugins: [tsconfigPaths(), react()]`, `environment: 'jsdom'` | [Next × Vitest](https://nextjs.org/docs/app/guides/testing/vitest) |
| `playwright.config.ts` + `e2e/` | Playwright | `webServer` qui lance `next build && next start`, `baseURL` | [Next × Playwright](https://nextjs.org/docs/app/guides/testing/playwright) |
| `vercel.json` | Vercel | Bonus : déclaration des `crons` → `app/api/cron/*` | onglet Vercel |

**À retenir** :

- **next-intl** : on suit le guide *sans routing i18n*, puisque la locale n'est pas dans l'URL mais dans la config produit. `i18n/request.ts` la lit via le root param `[app]`, et `NextIntlClientProvider` est posé dans le layout `(products)/[app]`.
- **Vitest** ne sait pas rendre les Server Components `async`. La doc Next recommande de les couvrir en E2E : Vitest teste donc `lib/` (ledger, schémas, rate limit) et les composants client, Playwright teste les pages.
- **Dépendances manquantes** dans l'onglet Stack, requises par le guide Vitest : `@vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`.

## Conventions de code et règles d'import

- **Alias unique `@/*`** vers la racine (posé dans `tsconfig.json` par shadcn init). Pas de `../../..`.
- **Sens des dépendances** : `app/` → `lib/dal/` → `lib/db/`. Seul `lib/dal/` importe `db`. Les pages et Server Actions passent toujours par le DAL, qui vérifie la session.
- **`import 'server-only'`** en tête de `lib/db/*`, `lib/dal/*`, `lib/auth.ts` et `lib/ai/*` : un import accidentel depuis un Client Component casse le build au lieu de fuir un secret.
- **Server Actions par domaine** : chaque domaine (une route) a son `_actions.ts` (`'use server'`), au même niveau que son `_components/` : `admin/products/_actions.ts` et `admin/products/_components/`, `[app]/checkout/_actions.ts` et `[app]/checkout/_components/`. Jamais de fichier d'actions partagé entre domaines, pour que deux agents en parallèle n'écrivent jamais le même fichier. La validation d'entrée réutilise les schémas de `lib/schemas/`.
- **Colocation d'abord, promotion ensuite** : un composant naît dans le `_components/` de sa route. Il monte dans `components/shared/` le jour où le BO et les produits l'utilisent tous les deux.
- **`components/ui/`** : du code shadcn copié dans le repo, modifiable mais rarement modifié. Les variantes métier vont dans `_components/`.
- **Nommage** : fichiers en kebab-case, composants exportés en PascalCase, tests unitaires colocalisés (`credits.test.ts` à côté de `credits.ts`), E2E dans `e2e/*.spec.ts`.
- **Pas de fichiers barrel** (`index.ts` qui réexporte) : ils brouillent la frontière serveur / client et le tree-shaking.
- **Commité vs ignoré** :
  - Commités : `drizzle/`, `fixtures/`, `.env.example`, `AGENTS.md`.
  - Ignorés : `.env*` (sauf l'exemple), `next-env.d.ts`, `.next/`, les rapports Playwright.

## Sources consultées

Lu le 24 septembre 2026 :

- [Next.js — Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) (v16.3.6)
- [Next.js — src folder](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder)
- [Next.js — Vitest](https://nextjs.org/docs/app/guides/testing/vitest) · [Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
- [Better Auth — Next.js integration](https://www.better-auth.com/docs/integrations/next) · [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Drizzle — Get started with PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)
- [next-intl — App Router without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
- [shadcn/ui — Next.js installation](https://ui.shadcn.com/docs/installation/next)
