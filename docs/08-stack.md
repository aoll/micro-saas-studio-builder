# Stack et librairies

Tout ce qu'il faut installer pour la v1, avec le rôle de chaque librairie et l'endroit où elle sert. Gestionnaire de paquets : pnpm. Les versions majeures sont indiquées quand elles comptent ; les versions exactes se fixent à l'installation.

## Dépendances de production

```bash
pnpm create next-app@latest   # Next.js 16.3.x, TypeScript, Tailwind v4, App Router
pnpm add ai @ai-sdk/react zod drizzle-orm postgres better-auth next-intl \
  botid @vercel/blob server-only \
  recharts sonner lucide-react class-variance-authority clsx tailwind-merge
pnpm dlx shadcn@latest init   # les composants shadcn sont copiés dans le repo, pas installés
```

| Librairie | Domaine | Rôle dans la démo | Priorité |
| --- | --- | --- | --- |
| `next` 16.3, `react` / `react-dom` 19.2 | Framework | App Router, Server Actions, Cache Components | v1 |
| `tailwindcss` v4 | UI | Styles, variables CSS des thèmes via `@theme inline` | v1 |
| shadcn/ui (CLI) + `class-variance-authority`, `clsx`, `tailwind-merge` | UI | Composants du backoffice et des sub-apps, thémés par variables CSS | v1 |
| `lucide-react` | UI | Icônes | v1 |
| `sonner` | UI | Toasts (sauvegarde, erreur, crédit remboursé) | v1 |
| `recharts` | UI | Graphiques des fiches produit (via les charts shadcn) | v1 |
| `zod` v4 | Validation | Schéma unique : config produit, formulaires, entrées des actions, sortie structurée IA | v1 |
| `drizzle-orm` + `postgres` | Données | ORM typé et driver Postgres, utilisés uniquement dans `lib/dal/` | v1 |
| `server-only` | Données | Empêche d'importer le DAL côté client (erreur au build) | v1 |
| `better-auth` | Auth | Sessions, lien magique (`magicLink`), rôle admin, adaptateur Drizzle | v1 |
| `ai` (AI SDK 7) | IA | `streamText`, `generateText`, `generateImage`, `Output.object` ; fournisseur AI Gateway intégré | v1 |
| `@ai-sdk/react` | IA | `useCompletion`, `useObject` côté client | v1 |
| `botid` | Sécurité | `withBotId` dans `next.config.ts`, `initBotId` dans `instrumentation-client.ts`, `checkBotId()` côté serveur | v1 |
| `@vercel/blob` | Stockage | Logos chargés dans le backoffice | v1 |
| `@ai-sdk/otel` | Observabilité | Traces des appels IA | Bonus |
| `flags` | Produit | A/B test du titre de landing | Bonus |
| `@vercel/analytics`, `@vercel/speed-insights` | Observabilité | Visites et Core Web Vitals des landings | Bonus |
| next-intl | i18n | Textes communs de la sub-app en français et en anglais ; langue lue depuis la config du produit via le root param \[app\] | v1 |

**À noter**

- Pas de `react-hook-form` : les formulaires passent par Server Actions + `useActionState`, et Zod valide côté serveur. On ne l'ajoute que si le formulaire en étapes (BO-05) devient trop lourd sans lui.
- Pas de `@ai-sdk/anthropic` : avec l'AI Gateway, le package `ai` accepte directement des chaînes `'anthropic/…'`. On ne l'installe que pour se passer du Gateway.
- Pas de Redis : le rate limit se fait dans Postgres (détail plus bas).
- AI SDK 7 impose **Node 22** et **ESM** (`"type": "module"` dans `package.json`).

## Dépendances de développement et de test

```bash
# TS 7 pour tsc, TS 6 sous le nom `typescript` pour ESLint (cf. onglet Tooling dev)
pnpm add -D @typescript/native@npm:typescript@^7 typescript@npm:@typescript/typescript6@^6 \
  drizzle-kit babel-plugin-react-compiler \
  vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths \
  @playwright/test @next/playwright \
  eslint eslint-config-next prettier prettier-plugin-tailwindcss tsx
```

| Librairie | Rôle | Priorité |
| --- | --- | --- |
| `typescript` v7 | Type-check natif, environ 10 fois plus rapide dans `next build` | v1 |
| `drizzle-kit` | Migrations et `drizzle-kit studio` pour inspecter la base | v1 |
| `babel-plugin-react-compiler` | Requis par `reactCompiler: true` (le compilateur Rust de la 16.3 est encore expérimental) | v1 |
| `vitest` | Tests du DAL : ledger, idempotence, remboursement, transitions de statut ; couverture (80 % sur lib/\*\*) avec @vitest/coverage-v8 | v1 |
| `@playwright/test` + `@next/playwright` | Tests e2e du script de démo et tests `instant()` | v1 |
| `eslint` + `eslint-config-next` (flat config), ou Biome à la place | Lint ; `next lint` n'existe plus depuis la v16 | v1 |
| `prettier` + `prettier-plugin-tailwindcss` | Formatage et tri des classes Tailwind | v1 |
| `tsx` | Exécuter les scripts `fixtures:record` et `db:seed` | v1 |

Les mocks IA (`MockLanguageModelV4`, `simulateReadableStream`) viennent du package `ai` lui-même (`ai/test`) : rien de plus à installer.

**Scripts `package.json`**

| Script | Commande |
| --- | --- |
| `dev` | `AI_MODE=mock next dev` |
| `dev:live` | `AI_MODE=live next dev` |
| `build` | `next typegen && next build` |
| `typecheck` | `scripts/queued.sh typecheck sh -c 'next typegen && tsc --noEmit'` |
| `test` | `scripts/queued.sh test vitest run` |
| `test:coverage` | `scripts/queued.sh test vitest run --coverage` |
| `test:e2e` | `scripts/queued.sh e2e playwright test` |
| `db:migrate` | `drizzle-kit migrate` |
| `db:seed` | `tsx scripts/seed.ts` |
| `fixtures:record` | `AI_MODE=live tsx scripts/record-fixtures.ts` |

**Outillage agents (hors `package.json`)**

- `.mcp.json` avec `next-devtools-mcp` (lancé via `npx`)
- Skill `next-dev-loop` : `npx skills add vercel/next.js --skill next-dev-loop`
- `agent-browser` v0.27+ en global : `npm install -g agent-browser@^0.27`
- `AGENTS.md` géré par `next dev`, référencé depuis `CLAUDE.md`

## Services externes et variables d'environnement

| Service | Usage | Variables |
| --- | --- | --- |
| Vercel (projet) | Hébergement, BotID, Blob, cron de remise à zéro (bonus) | `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` ; `VERCEL` (posée par la plateforme, jamais à la main : BotID n'est appliqué que si elle vaut `1`) |
| Postgres managé (Neon ou autre, via la Marketplace Vercel) | Base de données, rate limit | `DATABASE_URL` |
| AI Gateway | Appels LLM, budget plafonné | `AI_GATEWAY_API_KEY` (ou OIDC sur Vercel) |
| Better Auth | Sessions, lien magique | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| Application | Mode IA, mode démo public, rate limit | `AI_MODE` = `mock` ou `live` ; `DEMO_MODE` = `true` ou `false` ; `GENERATION_RATE_LIMIT_PER_MINUTE` (optionnelle, 10 par défaut) ; `SEED_ADMIN_*`, `SEED_OWNER_*` (identifiants du seed, exigés quand `DEMO_MODE=true`) |

Trois services seulement : Vercel, Postgres, AI Gateway. Ni Redis ni service d'email en v1.

### Email simulé : la boîte de réception en modale

Aucun email n'est envoyé. Better Auth génère bien le lien magique, mais sa fonction d'envoi (`sendMagicLink`) l'écrit en base au lieu de l'envoyer. Après « Recevoir mon lien », une **modale « Boîte de réception (démo) »** s'ouvre et affiche l'email tel que l'utilisateur le recevrait, aux couleurs du produit, avec le bouton « Me connecter ». Un clic valide le vrai lien et connecte l'utilisateur.

Le parcours reste fidèle (vrai token, vraie expiration, vraie session), il ne manque que l'envoi. Passer à un vrai service d'email plus tard ne change que `sendMagicLink`.

### Rate limit dans Postgres

Le rate limit n'a pas besoin de Redis à l'échelle de la démo. Avant chaque génération, `guardRequest('generate')` compte les lignes de `generations` des 60 dernières secondes pour l'utilisateur connecté et pour l'`ip_hash`, et répond 429 dès que l'un des deux atteint `GENERATION_RATE_LIMIT_PER_MINUTE` (10 par défaut). La table existe déjà : une requête indexée, aucun service en plus. L'inscription, l'achat et « Tester le prompt » passent par BotID seulement.

D'autres garde-fous limitent déjà l'abus : les crédits eux-mêmes (un utilisateur inscrit ne peut pas générer plus que son solde), une génération anonyme par cookie et par IP, BotID, et le budget plafonné de l'AI Gateway.

Upstash resterait gratuit ici (500 000 commandes par mois sur le palier gratuit). Il ne devient utile qu'avec du trafic réel, quand la base ne doit plus porter ce comptage.

**Suivis relevés pendant le run v1** (PR de contrat à décider) : un limiteur Postgres partagé (table `rate_limit_hits` ou stockage `database` du rate limit de Better Auth) pour « Tester le prompt », l'inscription, la connexion et le beacon d'events ; l'endpoint brut `/api/auth/sign-in/magic-link` de Better Auth, hors `guardRequest` ; un faux `verifyPassword` sur le chemin de refus de la connexion admin (`lib/auth.ts`), contre la mesure du temps de réponse.

### i18n : next-intl, langue portée par le produit

**Coût : une demi-journée**, parce que le périmètre est petit. Le contenu de chaque produit (landing, FAQ, prompt) est déjà rédigé dans sa langue dans la config ; il ne reste à traduire que les textes communs de la sub-app, environ 60 clés (`messages/fr.json`, `messages/en.json`). Le backoffice reste en français.

| Critère | next-intl | Paraglide JS |
| --- | --- | --- |
| Intégration Next.js 16.3 | Support natif de `next/root-params` (août 2026), compatible Cache Components ; exemple officiel où la langue vient d'un segment `[tenant]`, exactement notre cas avec `[app]` | Intégration Next.js App Router documentée, moins de retours sur Cache Components |
| Modèle | Messages JSON chargés côté serveur, `useTranslations` | Compilateur : chaque message devient une fonction typée, JavaScript client minimal |
| Usage dans l'écosystème Next.js | La référence | Plus répandu côté SvelteKit et Vite |

**Choix : next-intl.** Son intégration aux root params permet de lire la langue depuis la config du produit sans segment `/fr` ou `/en` dans l'URL, et de garder les landings pré-rendues. Paraglide reste une bonne option si l'on voulait optimiser le poids du JavaScript client, mais nos textes traduits sont peu nombreux et surtout rendus côté serveur.

À savoir : comme pour le reste, `next/root-params` n'est pas disponible dans les Server Actions ; les messages d'erreur renvoyés par une action reçoivent la langue en argument.

Sources : [next-intl et next/root-params](https://next-intl.dev/blog/nextjs-root-params) · [Paraglide JS pour Next.js](https://paraglidejs.com/next-js)

## Ce qu'on n'installe pas

| Librairie ou service | Pourquoi |
| --- | --- |
| `@anthropic-ai/sdk` | Remplacé par l'AI SDK et l'AI Gateway (voir onglet IA) |
| `stripe` | Paiement simulé en v1 |
| Upstash Redis | Rate limit fait dans Postgres |
| Service d'email (Resend…) | Email simulé dans une modale |
| `react-hook-form` | Server Actions + `useActionState` suffisent, sauf si BO-05 le justifie |
| `next-auth` | Better Auth retenu (un seul choix, pour que le repo reste lisible) |
| `workflow` | Pas de tâche longue dans la démo |
| `@tanstack/react-query`, `swr` | Les données arrivent par les Server Components et le streaming |

Pour plus tard, si la démo évolue : `stripe` (vrai paiement), un service d'email, Upstash (rate limit sous trafic réel), `flags` (A/B test), `@ai-sdk/otel` (traces).
