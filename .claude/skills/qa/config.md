# Config QA — micro-saas-studio-builder

Faits stables partagés par la skill `qa` et ses scénarios. Aucun secret ici :
les identifiants se lisent dans `scripts/seed.ts` ou dans les variables
`SEED_*`. Si un fait ci-dessous ne correspond plus au code, le code gagne :
corrige ce fichier dans une PR `docs(tooling)`, pas pendant la passe.

## Cible

- **Local uniquement.** `http://localhost:3000` dans le checkout principal
  (`pnpm dev`, CLAUDE.md) ; `http://localhost:3200` par défaut depuis un
  worktree (3100 est réservé aux E2E, `E2E_PORT`). Jamais une URL Vercel.
- `AI_MODE=mock` (posé par `pnpm dev`) : chaque produit rejoue sa fixture
  `fixtures/<slug>.json`, streamée ; zéro token.
- `DEMO_MODE=false` en local : pas de bandeau « Démo ». Pour vérifier le
  bandeau, relance le serveur avec `DEMO_MODE=true` (le seed, lui, refuse
  `DEMO_MODE=true` avec les identifiants de dev : ne re-seed pas dans ce mode).
- Paiement et email **simulés** en v1 (docs/01 › Paiement, docs/08 › Email
  simulé) : aucun débit réel possible, aucun email envoyé.
- Pas de page `/` : l'arborescence (docs/09) n'a pas de `app/page.tsx`, `/`
  répond 404.

## Environnement

```bash
# Postgres local (le hook SessionStart le fait déjà)
node .claude/hooks/session-start.mjs

# Base — worktree : base msb_<branche>, .env.local pointé dessus, migrate + seed
pnpm tsx scripts/worktree-db.ts ensure --seed
# Base — checkout principal : celle de DATABASE_URL dans .env.local (pas
# forcément `msb`). Elle peut porter l'usage de passes ou de runs précédents :
# reset-demo efface tout l'usage et les produits créés, puis rejoue le seed,
# pour que les chiffres exacts du scénario partent de l'état du seed.
grep DATABASE_URL .env.local
pnpm db:migrate && pnpm tsx scripts/reset-demo.ts

# Scratchpad de la passe (captures, scripts, journal du serveur)
QA=<scratchpad>/qa/<YYYY-MM-DD>-<scénario> && mkdir -p "$QA"

# Serveur de dev depuis un worktree : port libre + BETTER_AUTH_URL aligné.
# `pnpm dev` = `AI_MODE=mock next dev` ; les arguments après sont passés à next.
# `setsid sh -c` : le serveur a son propre groupe, dont le numéro (le PID du
# `sh`, gardé par `exec`) est écrit dans dev.pgid.
fuser 3200/tcp && echo "port 3200 pris : choisis-en un autre"
export QA
BETTER_AUTH_URL=http://localhost:3200 DEMO_MODE=false \
  setsid sh -c 'echo $$ > "$QA/dev.pgid"; exec pnpm dev -p 3200' > "$QA/dev.log" 2>&1 &

# Attente de disponibilité : sort seule (200, ou échec après ~2 min)
curl -s -o /dev/null -w '%{http_code}\n' --retry 60 --retry-delay 2 \
  --retry-connrefused --retry-all-errors --max-time 120 http://localhost:3200/lettre-pro

# Arrêt, en fin de passe
kill -TERM -- -"$(cat "$QA/dev.pgid")"
fuser 3200/tcp || echo "port libéré"   # encore pris : revérifie, puis kill -KILL -- -<pgid>
```

Jamais de `until`/`while pgrep -f …` : la boucle se voit elle-même et ne sort
jamais. Pour savoir si un port est pris : `fuser <port>/tcp` (`lsof` ne voit
pas les sockets dans ce conteneur). Le premier rendu d'une route compile (5 à
15 s en Turbopack) : c'est le `--max-time` qui le couvre, pas un `sleep`.

## Outillage

| Outil | Rôle | Installation | Repli |
|---|---|---|---|
| MCP `next-devtools` (`.mcp.json`) | erreurs, logs, routes, Server Actions du serveur de dev | automatique (`npx next-devtools-mcp@latest`) ; outils différés : `ToolSearch` `select:mcp__next-devtools__nextjs_index,mcp__next-devtools__nextjs_call,mcp__next-devtools__browser_eval` | `curl` sur `/_next/mcp` (ci-dessous) |
| Skill `next-dev-loop` | méthode : `/_next/mcp` + agent-browser après chaque action | vendorisée dans `.claude/skills/next-dev-loop/` (`npx skills add vercel/next.js --skill next-dev-loop --agent claude-code -y`) | — |
| `agent-browser` | vrai Chrome : DOM, snapshot, console, réseau, React, Suspense | `npm install -g agent-browser@latest` (next-dev-loop exige ≥ 0.31.1 ; docs/08 cite `^0.27`, trop ancien pour la skill) | Playwright (ci-dessous) |
| `@playwright/test` du repo | repli navigateur, scripts jetables | déjà dans `devDependencies` ; Chromium préinstallé dans `/opt/pw-browsers` | — |

**`/_next/mcp` en HTTP** (réponse SSE : lire la ligne `data:`) :

```bash
mcp() { curl -s --max-time 30 -X POST "http://localhost:3200/_next/mcp" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":{}}}" \
  | sed -n 's/^data: //p'; }
mcp get_errors      # après chaque parcours ; aussi get_logs, get_routes
```

**agent-browser dans ce conteneur** (headless, Chromium préinstallé, une
session par passe) :

```bash
export AGENT_BROWSER_SESSION=qa-<scénario> AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
agent-browser skills get core                      # usage exact de la version installée
agent-browser --enable react-devtools open http://localhost:3200/lettre-pro
agent-browser snapshot                             # arbre d'accessibilité + refs
agent-browser set viewport 390 844                 # mobile ; `set media dark` pour le sombre
agent-browser set headers '{"X-Forwarded-For":"10.0.1.1"}'   # IP simulée du parcours
agent-browser console ; agent-browser errors ; agent-browser network requests
agent-browser react suspense --only-dynamic        # trous dynamiques du shell
agent-browser screenshot "$QA/03-outil.png"
agent-browser close
```

Pas de `--headed` (pas d'écran). Une page blanche juste après `open` est une
session périmée : `close` puis `open` à nouveau (next-dev-loop › gotchas).

**Repli Playwright** (script dans `$QA`, jamais dans le repo ; `node $QA/<n>.mjs`) :

```js
import { createRequire } from "node:module";
const require = createRequire("/chemin/du/checkout/package.json"); // le checkout testé
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },            // sub-app : mobile d'abord
  extraHTTPHeaders: { "X-Forwarded-For": "10.0.1.1" },
  locale: "fr-FR",
});
const page = await context.newPage();
const log = [];
page.on("console", (m) => m.type() === "error" && log.push(`console: ${m.text()}`));
page.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));
page.on("response", async (r) => {
  if (r.request().method() !== "GET" || r.status() >= 400)
    log.push(`${r.request().method()} ${r.status()} ${r.url()}`);
});
await page.goto("http://localhost:3200/lettre-pro");
await page.screenshot({ path: `${process.env.QA}/01-landing.png`, fullPage: true });
console.log(log.join("\n"));
await browser.close();
```

Jamais `playwright install`. Le proxy HTTPS du conteneur n'est pas nécessaire
pour `localhost`.

## Personas

| Persona | Comment l'obtenir | Ce qu'elle couvre | Notes |
|---|---|---|---|
| **Visiteur anonyme** | contexte navigateur neuf, IP simulée propre (`X-Forwarded-For: 10.0.<n>.1`) | SA-01, SA-02 (génération gratuite), SA-04, SA-08, SEO | La génération gratuite est limitée par cookie **et** IP (`recordAnonymousGeneration`) : en local toutes les requêtes viennent de la même IP ; sans en-tête distinct, le 2e visiteur anonyme d'un produit est refusé (401 `signup_required`), comportement voulu. |
| **Inscrit** | modale `/{slug}/signup` après la génération gratuite ; email jetable `qa-<parcours>-<horodatage>@example.test` ; « Recevoir mon lien de connexion » → « Boîte de réception (démo) » → « Me connecter » | SA-03, SA-05, SA-06, SA-07 | +3 crédits une seule fois par produit (crédits par produit : docs/07). Un compte par parcours. |
| **Admin de démo** | `/admin/login`, email et mot de passe de `DEV_ADMIN` dans `scripts/seed.ts` (`admin@msb.local`), ou `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` s'ils sont posés | BO-01 à BO-09 | `/admin/ops` doit lui répondre 404. |
| **Owner** | `/admin/login` avec `DEV_OWNER` (`owner@msb.local`) ou `SEED_OWNER_*` | `/admin/ops`, tout le BO | Seul rôle qui voit `/admin/ops`. |
| **Utilisateur `role=user` au BO** | un inscrit qui tente `/admin/login` | BO-01 (refus) | Même message que de mauvais identifiants : « Identifiants invalides ». |

Le seed (`scripts/seed.ts`, déterministe) : 4 thèmes (`editorial`, `neon`,
`corporate`, `playful`) ; LettrePro `/lettre-pro` (Editorial, Scale, 1 200
visites, « à scaler »), DescriPro `/descri-pro` (Corporate, Learn, sans badge),
NomDeMarque `/nom-de-marque` (Playful, Test, « à couper ») ; tous en `fr`, packs
`pack-10` (10 crédits, 4,90 €) et `pack-50` (50 crédits, 14,90 €, recommandé).
BioInsta n'est pas seedé : sa config (`fixtures/bio-instagram.config.json`,
`locale: "en"`, thème Neon) sert à le créer pendant la passe, et c'est le
produit anglais des vérifications fr/en.

## Delta

Table du mode `delta` (skill `qa` › 2 bis) : un fichier `A`, `M` ou `D` de
`pnpm tsx scripts/qa-baseline.ts diff` met en profondeur les étapes du
scénario dont la référence cite une spec de sa ligne. Chemins abrégés :
`[app]/` = `app/(products)/[app]/`, `admin/` = `app/(backoffice)/admin/`. La
ligne la plus précise gagne ; un fichier qu'aucune ligne ne couvre met tout le
scénario en profondeur (et la table se complète dans une PR `docs(tooling)`).

| Fichiers | Specs en profondeur |
|---|---|
| `[app]/page.tsx`, `[app]/_components/landing/**`, `messages/*/landing.json` | SA-01 |
| `[app]/tool/**`, `[app]/api/generate/**`, `messages/*/tool.json`, `lib/ai/**`, `lib/dal/generations.ts`, `fixtures/**` | SA-02 |
| `[app]/signup/**`, `[app]/@modal/(.)signup/**`, `messages/*/auth.json`, `lib/dal/magic-link.ts`, `lib/auth*.ts`, `app/api/auth/**` | SA-03, BO-01 |
| `[app]/pricing/**`, `[app]/@modal/(.)pricing/**`, `messages/*/pricing.json` | SA-04 |
| `[app]/checkout/**`, `[app]/@modal/(.)checkout/**`, `messages/*/checkout.json` | SA-05 |
| `lib/dal/credits.ts` | SA-02, SA-03, SA-05, SA-07, LEDGER |
| `[app]/history/**`, `messages/*/history.json`, `lib/dal/history.ts` | SA-06 |
| `[app]/account/**`, `messages/*/account.json`, `lib/dal/account.ts` | SA-07 |
| `[app]/not-found.tsx`, `app/(products)/_components/**`, `[app]/@modal/[...catchAll]/**`, `messages/*/not-found.json` | SA-08 |
| `[app]/layout.tsx`, `[app]/_lib/**`, `[app]/icon.tsx`, `[app]/opengraph-image.tsx`, `app/robots.ts`, `app/sitemap.ts`, `messages/manifest.ts`, `messages/*/common.json` | toute la sub-app (SA-01 à SA-08), I18N-SEO |
| `[app]/api/events/**`, `lib/dal/events.ts` | TRACKING, BO-03, BO-04 |
| `admin/login/**`, `lib/dal/session.ts` | BO-01 |
| `admin/page.tsx`, `admin/_components/portfolio/**`, `lib/dal/metrics.ts`, `lib/decision.ts` | BO-02, BO-03 |
| `admin/products/[slug]/page.tsx`, `admin/products/[slug]/_components/**` hors `status/` | BO-03 |
| `admin/products/[slug]/activity/**`, `lib/dal/activity.ts` | BO-04 |
| `admin/products/new/**`, `admin/products/[slug]/edit/**`, `admin/products/_components/product-form/**`, `admin/products/_actions.ts`, `lib/dal/product-editor.ts`, `lib/dal/products.ts` | BO-05a, BO-05b |
| `admin/products/[slug]/_components/status/**`, `admin/products/[slug]/_actions.ts`, `lib/dal/product-status.ts` | BO-06 |
| `admin/themes/**`, `lib/dal/themes.ts`, `lib/fonts.ts` | BO-07, BO-08, CONTRACT-ui |
| `admin/settings/**`, `lib/dal/thresholds.ts` | BO-09 |
| `admin/ops/**` | DEMO-mode |
| `lib/security.ts`, `lib/rate-limit.ts`, `proxy.ts` | SECURITY, SA-02, BO-01 |
| `lib/db/**`, `lib/schemas/**`, `lib/env.ts`, `app/globals.css`, `admin/loading.tsx` | tout le scénario |

## Garde-fous (non négociables)

- Local seulement ; jamais d'URL déployée.
- Paiement simulé : la mention « Paiement simulé pour la démo » doit être
  visible avant « Payer … (simulé) ».
- « Réinitialiser la démo » (`/admin/ops`) : uniquement en dernière étape d'un
  scénario qui le prévoit, puis `pnpm db:seed` (ou `worktree-db.ts ensure --seed`).
- Un compte jetable par parcours ; jamais de boucle de création de comptes.
- Rate limit : `GENERATION_RATE_LIMIT_PER_MINUTE` (10 par défaut) générations
  par 60 s par utilisateur **et** par IP. Espace les générations ou change
  d'IP simulée entre parcours, sauf à l'étape qui teste le 429.
- Produits, thèmes et seuils seedés : noter la valeur, modifier, restaurer.
  Seul un produit créé pendant la passe passe en Killed.
- Aucune correction de code ; captures et scripts dans `$QA` (scratchpad).

## Rapport

`.claude/qa/reports/<YYYY-MM-DD>-<scénario>.md`, format dans
`.claude/qa/reports/README.md`. Catégories : **BUG** (bloquant / majeur /
mineur) et **MANQUE**. Committé seul, `docs(qa): …`.
