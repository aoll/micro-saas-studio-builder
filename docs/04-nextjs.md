# Next.js dans la démo

## Version cible et vue d'ensemble

**Next.js 16.3.6** (App Router, Turbopack, React 19.2), avec les deux flags du nouveau modèle activés dès le départ : `cacheComponents` et `partialPrefetching`. La 16.3 stable date du 3 août 2026 ; la 16.3.6 est le correctif de sécurité publié le 22 septembre 2026, à prendre d'office.

Partir sur un projet neuf est un avantage : pas de migration, on adopte directement le modèle que Next.js annonce comme le défaut de la prochaine version majeure (« dynamic by default », cache explicite, navigations instantanées). C'est aussi un signal fort en entretien : la démo est à jour de la dernière version du framework.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,     // 'use cache', PPR, dynamique par défaut
  partialPrefetching: true,  // un shell préchargé par route, réutilisé entre liens
  reactCompiler: true,       // mémoïsation automatique
  typedRoutes: true,         // liens et redirections typés
};
```

| Besoin de la démo | Outil Next.js |
| --- | --- |
| Une sub-app par produit sur `/{slug}` | Segment dynamique `[app]`, route groups, layout par produit |
| Config produit lue à chaque requête sans coût | `'use cache'` + `cacheTag('product:{slug}')` |
| Produit modifié visible tout de suite | `updateTag()` dans la Server Action de sauvegarde |
| Formulaires backoffice et outil | Server Actions, `useActionState`, validation Zod côté serveur |
| Débit de crédits et achat | Server Actions transactionnelles, `useOptimistic` pour le solde |
| Tracking des events sans ralentir | `after()` |
| SEO par produit | `generateMetadata`, `opengraph-image`, `sitemap.ts`, `robots.ts` |
| Génération IA progressive | Streaming (Route Handler ou Server Action), `<Suspense>` |
| Modales inscription et paiement | Parallel + intercepting routes (`@modal`) |
| Thèmes par produit | Variables CSS dans le layout `[app]`, `next/font` |
| Produit inconnu ou killed | `notFound()` + `not-found.tsx` |
| Dashboards rapides | Cache Components : shell statique + données en streaming |
| Delivery par agents | `AGENTS.md` géré par `next dev`, MCP DevTools, Skills, `instant()` Playwright |

## Routing

**Deux root layouts séparés par des route groups** : un pour le backoffice, un pour les sub-apps. Le segment `[app]` se trouve alors *au-dessus* du root layout des sub-apps, ce qui en fait un **root param** (nouveauté 16.3) : n'importe quel Server Component peut lire le produit courant avec `await app()`, sans passer `params` de composant en composant.

```
app/
  (backoffice)/
    layout.tsx                    // root layout admin (<html>)
    admin/
      page.tsx                    // portefeuille
      products/new/page.tsx
      products/[slug]/page.tsx
      products/[slug]/activity/page.tsx
      themes/page.tsx
  (products)/
    [app]/
      layout.tsx                  // root layout produit : <html>, thème, header, slot @modal
      page.tsx                    // landing
      tool/page.tsx
      history/page.tsx
      pricing/page.tsx
      checkout/[packId]/page.tsx  // page complète (accès direct, refresh)
      signup/page.tsx
      @modal/
        default.tsx               // return null (obligatoire depuis la v16)
        (.)checkout/[packId]/page.tsx  // modale de paiement interceptée
        (.)signup/page.tsx        // modale d'inscription interceptée
        [...catchAll]/page.tsx    // ferme la modale sur les autres navigations
      not-found.tsx               // produit inconnu ou killed (SA-08)
proxy.ts                          // optionnel : {slug}.domaine.com → /{slug}
```

```tsx
// lib/dal/products.ts — utilisable dans tout Server Component de la sub-app
import { app } from 'next/root-params'
import { cacheLife, cacheTag } from 'next/cache'

export async function getProductConfig() {
  'use cache'
  cacheLife('max')
  const slug = await app()          // la clé de cache ne contient que `app`
  cacheTag(`product:${slug}`)
  return db.query.products.findFirst({ where: eq(products.slug, slug) }) ?? null
}

// dans le layout [app] : hors du scope mis en cache
const product = await getProductConfig()
if (!product || product.status === 'killed') notFound()
```

**Les modales en intercepting routes** (inscription SA-03, paiement SA-05) sont le point fort du routing de la démo :

- **Navigation depuis l'outil** : le lien vers `/bio-instagram/checkout/pack-50` ouvre la modale par-dessus l'outil. L'URL change, mais l'utilisateur ne quitte pas la page. C'est exactement la continuité voulue pour la démo.
- **Refresh ou lien direct** : la même URL rend la page complète `checkout/[packId]`. Rien ne casse.
- **Retour arrière** : `router.back()` ferme la modale, le bouton « précédent » du navigateur aussi.
- **Contenu partagé** : le formulaire de paiement est un seul composant, rendu dans `<Modal>` ou dans la page. En plein écran sur mobile, c'est juste du CSS sur `<Modal>`.

**À savoir**

- Avec Cache Components, un root param doit avoir **au moins une valeur** dans `generateStaticParams`, sinon le build échoue. On y renvoie les slugs des produits existants ; un produit créé après le build sert d'abord un shell instantané, puis sa version prérendue (le nouvel ISR de la 16.3).
- `next/root-params` n'est pas disponible dans les **Server Actions** : elles reçoivent le slug en argument.
- Passer du backoffice à une sub-app change de root layout, donc provoque un chargement complet. C'est sans conséquence ici : ce sont deux applications distinctes pour l'utilisateur.
- `proxy.ts` (ex-`middleware.ts`) sert au bonus des sous-domaines (simple réécriture) et, depuis QA1-P1-B4, à poser le cookie `anonymous_id` sur la première requête GET d'une page produit, avant que `<TrackVisit>` n'envoie son beacon, et, depuis QA1-P1-B12, de garde de session optimiste sur `/admin` (présence du cookie de session seulement : 307 vers `/admin/login`, vrai 404 sur `/admin/ops`, sans lire le rôle) : jamais d'accès base ni de contrôle d'autorisation dedans, la vraie vérification reste `requireAdmin()` et le contrôle du rôle owner côté serveur.
- `typedRoutes: true` type les `href` et `router.push` : une faute dans une route casse la compilation.

## Rendu et cache

Avec `cacheComponents`, **tout est dynamique par défaut** et rien n'est mis en cache sans le dire. Chaque `await` côté serveur devient un choix explicite : le mettre en cache (`'use cache'`), le streamer (`<Suspense>`) ou bloquer la route (`export const instant = false`). Le dev overlay signale tout `await` non tranché (Instant Insights). Pour la démo, le partage est net : **ce qui vient du backoffice est mis en cache, ce qui dépend de l'utilisateur est streamé.**

| Donnée | Stratégie | `cacheLife` | Tag | Invalidée par |
| --- | --- | --- | --- | --- |
| Config d'un produit | `'use cache'` | `max` | `product:{slug}` | `updateTag` dans l'action « Enregistrer » du backoffice |
| Thème | `'use cache'` | `max` | `theme:{id}` | `updateTag` dans l'action de l'éditeur de thème |
| Liste des produits (portefeuille, SA-08) | `'use cache'` | `max` | `products` | `updateTag` à la création ou au changement de statut |
| Métriques d'un produit | `'use cache'` | `minutes` | `metrics:{slug}` | Le temps (les events arrivent en continu) |
| Solde, historique, compte | Streamé sous `<Suspense>` | — | — | `refresh()` après une génération ou un achat |

**Ce que ça donne à l'écran**

- **Landing** : entièrement issue de la config et du thème, donc entièrement dans le shell statique. Chargement instantané, idéal pour le SEO.
- **Outil** : le formulaire (issu de la config) est dans le shell ; seul le badge de solde, qui lit la session, arrive en streaming derrière un `<Suspense>`.
- **Backoffice** : la structure des dashboards est dans le shell, les chiffres arrivent en streaming ou depuis le cache `minutes`.

**Le moment « mutualisation » de la démo** : modifier un thème appelle `updateTag('theme:neon')`. Tous les produits qui utilisent ce thème sont à jour à la requête suivante, sans déploiement.

**Quel outil d'invalidation, quand**

- `updateTag(tag)` : dans une **Server Action**, sémantique « lire ses propres écritures ». L'admin qui enregistre voit tout de suite le résultat. C'est le cas de toutes les sauvegardes du backoffice.
- `revalidateTag(tag, 'max')` : stale-while-revalidate, utilisable aussi dans un Route Handler. Réservé à un futur webhook (Stripe).
- `refresh()` : rafraîchit les données **non mises en cache** de la page (le solde) après une action, sans toucher au cache.

**Navigations instantanées (`partialPrefetching`)** : Next.js précharge **un shell réutilisable par route**, pas une requête par lien. Dans le portefeuille, les quatre liens vers `/admin/products/[slug]` partagent un seul shell préchargé : le clic affiche la fiche immédiatement, les chiffres suivent.

**À savoir**

- Pas de `cookies()` ni `headers()` dans un scope `'use cache'`, y compris dans les fonctions qu'il appelle : on lit ces valeurs à l'extérieur et on les passe en argument.
- Toujours un `cacheLife` explicite dans chaque scope mis en cache (recommandation de la doc).
- Le cache par défaut est **en mémoire**. En serverless, il ne survit pas forcément d'une requête à l'autre ; sur un serveur Node persistant (Docker sur Fly.io, par exemple), si. Pour la démo, les deux conviennent : le shell statique est de toute façon produit au build.
- `NEXT_PRIVATE_DEBUG_CACHE=1` affiche les hits et misses du cache, utile pendant le développement.

## Mutations : Server Actions et Data Access Layer

Toutes les écritures passent par des **Server Actions minces** qui délèguent à un **Data Access Layer** (DAL) `server-only`. C'est l'organisation que la doc recommande pour un projet neuf, et elle recoupe exactement le découpage de la démo : `lib/dal/credits.ts` et `lib/dal/products.ts` portent la logique, les actions ne font que valider, appeler et invalider.

```
lib/
  dal/                 // import 'server-only' ; seul endroit qui touche la base et process.env
    credits.ts         // debit, refund, purchase (transactions, idempotence)
    products.ts        // create, update, setStatus
    themes.ts
    session.ts         // getCurrentUser, requireAdmin
  schemas/             // schémas Zod partagés (form, DAL, runtime)
app/
  (backoffice)/admin/products/_actions.ts   // 'use server' : saveProduct, setStatus
  (products)/[app]/checkout/_actions.ts    // 'use server' : purchase (une action par domaine)
```

| Action | Déclenchée par | Ce qu'elle fait | Après |
| --- | --- | --- | --- |
| `saveProduct` | Formulaire BO-05 | `requireAdmin`, validation Zod, écriture | `updateTag('product:{slug}')`, `updateTag('products')` |
| `setProductStatus` | Modale BO-06 | `requireAdmin`, transition de statut | `updateTag('product:{slug}')`, `updateTag('products')` |
| `saveTheme` | Éditeur BO-08 | `requireAdmin`, validation des tokens | `updateTag('theme:{id}')` |
| `testPrompt` | Bouton « Tester le prompt » | Appel IA sans débit | — |
| `purchase` | Modale de paiement SA-05 | Achat + crédits en une transaction, clé d'idempotence | `refresh()` (solde) |
| `signup` | Modale SA-03 | Création du compte + bonus d'inscription | `refresh()` |

**Côté UI**

- **`useActionState`** sur tous les formulaires : erreurs de validation renvoyées par l'action, bouton désactivé pendant `pending`. Dans le formulaire en étapes (BO-05), chaque étape valide sa partie du schéma Zod.
- **`useOptimistic`** pour le badge de solde : il passe à `-1` dès le clic sur « Générer » et revient à la valeur serveur si l'appel échoue (remboursement).
- **`.bind(null, slug)`** pour passer le produit à l'action : `next/root-params` n'est pas disponible dans les Server Actions.

**Le tracking, en deux voies selon le type de page**

- **Events d'action** (génération, inscription, achat) : écrits avec `after()` dans la Server Action ou le Route Handler, *après* l'envoi de la réponse. Aucune latence ajoutée, et `after()` peut y lire cookies et headers.
- **Visites de la landing** : la landing est pré-rendue, et sur une page statique `after()` s'exécute **au build** (ou à la revalidation), pas à chaque visite. Un petit composant client `<TrackVisit slug=… />` envoie donc l'event par `navigator.sendBeacon` vers un Route Handler `api/events`, qui l'écrit en base. La landing reste statique, et le premier chiffre du funnel est juste.

Le Route Handler `api/events` n'accepte que les types d'events publics (visite) : les autres ne s'écrivent que côté serveur, pour qu'on ne puisse pas fausser le funnel depuis le navigateur.

```ts
'use server'
export async function purchase(slug: string, packId: string, idempotencyKey: string) {
  const user = await requireUser()                       // vérifié dans chaque action
  const result = await credits.purchase({ user, slug, packId, idempotencyKey })
  after(() => track({ type: 'purchase', slug, userId: user.id, packId }))
  refresh()                                              // solde et header à jour
  return { balance: result.balance }                     // jamais l'enregistrement brut
}
```

**Sécurité (à appliquer partout)**

- Une Server Action est un **endpoint POST public** : authentification *et* autorisation dans chaque action, même si la page est déjà protégée.
- Valider toutes les entrées (Zod), y compris le `slug` et le `packId`.
- Ne renvoyer que ce dont l'UI a besoin.
- Le coût IA justifie un **rate limit** sur `generate` ; `guardRequest(kind)` (`lib/security.ts`) passe aussi l'inscription, l'achat et « Tester le prompt » par BotID, sans rate limit.

## SEO par produit

Chaque produit a son propre référencement, **entièrement généré depuis la config** saisie à l'étape « Landing & SEO » du backoffice. C'est central pour Dotworld, dont les produits vivent du trafic organique.

| Fichier | Contenu | Source |
| --- | --- | --- |
| `[app]/page.tsx` → `generateMetadata` | Titre, description, canonical, Open Graph | `landing.seoTitle`, `landing.seoDescription` |
| `[app]/layout.tsx` → `metadata` | `metadataBase`, base des URL relatives (canonical, images) | `BETTER_AUTH_URL` |
| `[app]/layout.tsx` → `generateViewport` | `themeColor` de la barre du navigateur mobile | Couleur principale du thème |
| `[app]/opengraph-image.tsx` | Image de partage 1200×630 aux couleurs du produit | Nom, titre, thème, via `ImageResponse` |
| `[app]/icon.tsx` | Favicon généré (initiale ou logo sur la couleur du thème) | Branding |
| `app/sitemap.ts` | Toutes les landings des produits non `killed` | Liste des produits |
| `app/robots.ts` | Autorise les landings, interdit `/admin` | — |

```tsx
// app/(products)/[app]/page.tsx
export async function generateMetadata(): Promise<Metadata> {
  'use cache'
  cacheLife('max')
  const product = await getProductConfig()   // même fonction, même tag product:{slug}
  return {
    title: product?.landing.seoTitle,
    description: product?.landing.seoDescription,
    alternates: { canonical: `/${product?.slug}` },
  }
}
```

**À savoir**

- Avec Cache Components, un `generateMetadata` non mis en cache sur une page par ailleurs statique lève une erreur : la doc demande de trancher. Ici, `'use cache'` est le bon choix. Les métadonnées sont alors dans le HTML initial, ce que veulent les moteurs de recherche.
- Tout dépend du tag `product:{slug}` : le même `updateTag` qui rafraîchit la landing rafraîchit aussi titre, image OG et favicon après une modification dans le backoffice.
- `metadataBase` ne varie pas d'un produit à l'autre : il vit dans un export `metadata` statique du layout `[app]`, hors de tout scope `'use cache'` (un objet `URL` n'y serait pas sérialisable).
- `opengraph-image` et `sitemap` sont des Route Handlers spéciaux, mis en cache par défaut ; `params` y est une Promise depuis la v16.
- `ImageResponse` ne gère que le flexbox et un sous-ensemble de CSS : on garde l'image OG simple.

**Moment de démo possible** : coller l'URL d'un produit fraîchement créé dans un outil de prévisualisation de partage (Slack, LinkedIn Post Inspector) et montrer l'image OG générée aux couleurs du thème.

## Streaming, chargement et erreurs

**La génération IA passe par un Route Handler qui streame**, pas par une Server Action : la réponse s'affiche mot à mot, et un Route Handler donne la main sur la réponse HTTP (flux, statut, durée max). Le débit de crédit, lui, reste dans le DAL.

```
(products)/[app]/api/generate/route.ts   // POST : débit → stream IA → enregistrement ou remboursement
```

1. Authentification, validation Zod des entrées par rapport aux champs de la config.
2. `credits.debit()` avec la clé d'idempotence ; si le solde est insuffisant, réponse 402 et ouverture du paywall côté client.
3. Stream de la réponse IA (AI SDK) vers le client.
4. À la fin du flux, dans `after()` : enregistrement de la génération, de son coût en tokens et de l'event. En cas d'erreur du fournisseur IA : `credits.refund()`.

`RouteContext<'/[app]/api/generate'>` type les `params` du handler, et `export const maxDuration` borne la durée d'une génération.

**Chargement**

- Avec Cache Components, les `<Suspense>` placés au plus près des données dynamiques (badge de solde, historique, chiffres des dashboards) suffisent : Next.js en tire le shell de chaque route. Pas besoin d'un `loading.tsx` par page.
- Le **Navigation Inspector** des DevTools met une navigation en pause sur son shell, pour vérifier ce que l'utilisateur voit au clic.
- Squelettes shadcn comme `fallback`, pour que le shell ait déjà la forme de la page.

**Erreurs**

| Cas | Outil | Dans la démo |
| --- | --- | --- |
| Erreur attendue (validation, solde insuffisant) | Valeur de retour + `useActionState` | Messages sous les champs, paywall |
| Produit inconnu ou fermé | `notFound()` + `not-found.tsx` | Écran SA-08 |
| Erreur inattendue dans un segment | `error.tsx` avec `retry()` | Page d'erreur thémée de la sub-app |
| Erreur dans un bloc précis | `catchError` de `next/error` (16.3), avec `retry()` qui re-rend les Server Components | Un widget de métriques qui échoue sans casser le dashboard |
| Échec du fournisseur IA | Gestion dans le Route Handler | Message « crédit remboursé » (SA-02) |

`catchError` est le bon outil pour les dashboards : chaque carte de métriques a sa propre frontière d'erreur avec un bouton « Réessayer », et contrairement aux anciennes error boundaries, elle ne gêne pas `notFound()` ni `redirect()`.

## Rendu et expérience front

Le principe est le même sur tous les écrans : **Server Components par défaut, shell statique le plus large possible, JavaScript client seulement sur les feuilles interactives**. La landing, première page qu'ouvrira un recruteur, doit être entièrement pré-rendue et embarquer presque aucun JavaScript.

### Stratégie de rendu par écran

| Écran | Rendu | Statique (shell) | Streamé sous `<Suspense>` |
| --- | --- | --- | --- |
| Landing `/[app]` | Pré-rendue : `generateStaticParams` pour les produits seedés, ISR pour ceux créés ensuite | Toute la page : config, thème, SEO | Le bouton de compte du header uniquement |
| Outil `/[app]/tool` | Shell statique + îlot client | Titre, formulaire généré depuis la config | Solde ; résultat IA via `useCompletion` |
| Historique, compte | Dynamique | Structure, squelettes | Données de l'utilisateur |
| Modales paiement, inscription | Intercepting routes | Contenu du pack, formulaire | Solde après achat |
| Backoffice | Dynamique (session admin) | Sidebar, structure des dashboards | Chiffres, tableaux, graphiques |

### Trois points à ne pas rater

1. **Isoler ce qui lit la session.** Le badge de solde (ou le bouton « Connexion ») du header lit les cookies. Posé tel quel dans le layout `[app]`, il ferait perdre le pré-rendu à toute la landing. Il vit dans son propre `<Suspense>` avec un fallback statique ; un test `instant()` sur la landing le garantit.
2. **Placer les frontières `'use client'` sur les feuilles.** Composants client : formulaire de l'outil, modales, graphiques Recharts (qui reçoivent des données déjà agrégées côté serveur), liste des champs de l'outil, aperçu en direct de BO-05. Tout le reste est Server Component.
3. **Soigner le LCP de la landing.** `next/image` avec `priority` et des `sizes` corrects sur le visuel du hero ; seule la police du thème actif est préchargée ; aucun décalage de mise en page au chargement.

### Outils pour l'expérience

| Outil | Où | Effet |
| --- | --- | --- |
| `<Activity>` (React 19.2) | Formulaire en étapes BO-05 | Les étapes masquées gardent leur état sans être démontées : retour en arrière sans perte |
| `<ViewTransition>` (React 19.2) | Changement d'étape, ouverture des modales | Transitions fluides, sans librairie d'animation |
| `useLinkStatus` (`next/link`) | Liens du backoffice | Indicateur discret sur le lien cliqué pendant la navigation |
| `useOptimistic` | Badge de solde | -1 immédiat au clic, correction si échec |
| `abortSignal` (AI SDK) | Bouton « Arrêter » de la génération | L'utilisateur garde la main pendant le streaming |
| Squelettes shadcn en `fallback` | Tous les `<Suspense>` | Le shell a déjà la forme de la page |

### Accessibilité et robustesse

- Modales shadcn / Radix : focus piégé dans la modale, fermeture par Échap, retour du focus à l'élément d'origine.
- `aria-live="polite"` sur la zone de résultat streamée, pour les lecteurs d'écran.
- Formulaires en Server Actions : ils fonctionnent même avant le chargement du JavaScript.
- Clair et sombre par `prefers-color-scheme`, sans flash au chargement.

### Mesurer plutôt que supposer

- Analyseur de bundle (expérimental depuis la 16.1) : vérifier le poids du JavaScript client de la landing.
- Un test `instant()` par parcours clé : landing, portefeuille → fiche produit, outil → modale de paiement.
- Navigation Inspector pendant le développement ; Speed Insights en bonus pour les Core Web Vitals réels.

## Thèmes, polices et images

Le thème d'un produit s'applique **dans le root layout `[app]`**, rendu dans le shell statique : aucun flash de thème par défaut, aucun JavaScript côté client pour le thème.

```tsx
// app/(products)/[app]/layout.tsx
export default async function ProductLayout({ children, modal }: LayoutProps<'/[app]'>) {
  const product = await getProductConfig()
  if (!product || product.status === 'killed') notFound()
  const theme = await getTheme(product.themeId)          // 'use cache' + cacheTag(`theme:${id}`)
  return (
    <html lang={product.locale} className={fonts[theme.fontKey].variable}
          style={toCssVars(theme.tokens, product.branding)}>  {/* --primary, --background, --radius… */}
      <body>{children}{modal}</body>
    </html>
  )
}
```

- **Couleurs et formes** : les tokens du thème deviennent les variables CSS de shadcn/ui (`--background`, `--primary`, `--radius`…). Tailwind v4 les lit via `@theme inline`. Tous les composants suivent sans aucune modification.
- **Clair et sombre** : chaque thème définit les deux jeux de tokens ; `prefers-color-scheme` choisit, sans JavaScript.
- **Polices** : `next/font` télécharge les polices **au build** et les auto-héberge ; elles ne peuvent donc pas être choisies librement à l'exécution. On déclare un **catalogue fixe** dans `lib/fonts.ts` (4 à 5 polices, chacune avec l'option `variable`), et un thème référence une clé de ce catalogue. C'est une contrainte à assumer dans l'éditeur de thème (BO-08) : une liste déroulante, pas un champ libre.
- **Logos** : `next/image` pour les logos et les exemples de résultats. Depuis la v16, une image distante nécessite `images.remotePatterns` (le stockage des logos), et `images.domains` est déprécié.
- **Vignettes de thèmes (BO-05, BO-07)** : ce sont de vrais mini-rendus React avec les tokens du thème, pas des images. Un thème modifié met à jour sa vignette automatiquement.
- **Transitions** : React 19.2 fournit `<ViewTransition>` ; un fondu entre les étapes du formulaire BO-05, ou à l'ouverture de la modale de paiement, est un détail qui soigne la démo.

## Outillage et delivery par agents

Next.js 16.3 outille explicitement le développement par agents. Pour une candidature chez Dotworld (« We develop with AI, not alongside it », Claude Code en outil préféré), **c'est l'argument le plus fort de la démo** : le repo montre une boucle agentique branchée sur les outils officiels du framework.

| Outil | Ce qu'il apporte | Mise en place |
| --- | --- | --- |
| `AGENTS.md` géré par `next dev` | L'agent lit la doc de la version installée (`node_modules/next/dist/docs/`), pas ses souvenirs d'entraînement | Automatique ; on committe le bloc tel quel, et `CLAUDE.md` y renvoie |
| `next-devtools-mcp` | Erreurs, logs, routes, Server Actions du serveur de dev ; `get_compilation_issues` et `compile_route` pour vérifier la compilation sans `next build` | `.mcp.json` à la racine |
| Skill `next-dev-loop` + `agent-browser` | L'agent pilote un vrai navigateur après chaque modification : DOM, console, réseau, arbre React, Suspense en attente | `npx skills add vercel/next.js --skill next-dev-loop` |
| Skill `next-cache-components-optimizer` | Rend une navigation instantanée : écrit un test `instant()` qui échoue, corrige la route, committe le test | Même commande, autre skill |
| Instant Insights + « Copy prompt » | Chaque `await` non tranché devient une erreur avec trois correctifs et un prompt prêt à donner à l'agent | Actif avec `cacheComponents` |
| `@next/playwright` → `instant()` | Test e2e qui vérifie ce qui s'affiche *au clic*, avant toute donnée réseau | `pnpm add -D @next/playwright @playwright/test` |
| Navigation Inspector | Met une navigation en pause sur son shell | Dans les DevTools Next.js |

```json
// .mcp.json
{ "mcpServers": { "next-devtools": { "command": "npx", "args": ["-y", "next-devtools-mcp@latest"] } } }
```

**Tests `instant()` à écrire pour la démo** (ils protègent le moment « waouh ») :

1. Landing d'un produit : titre, promesse et CTA visibles dès le chargement.
2. Portefeuille → fiche produit : nom et statut immédiats, chiffres en streaming.
3. Outil → modale de paiement : la modale s'ouvre sans attendre le serveur.

Contre un build de production : `experimental.exposeTestingApiInProductionBuild: true`.

**Performance et qualité du build**

- **Turbopack** par défaut, avec cache disque en dev et en build (activé par défaut en 16.3) : redémarrages et builds plus rapides.
- **TypeScript 7** pour le type-check de `next build` (`typescript@^7` en devDependency), dix fois plus rapide.
- **React Compiler** (`reactCompiler: true`) : plus de `useMemo` ni `useCallback` à la main.
- `next typegen` génère `PageProps`, `LayoutProps`, `RouteContext` et les types de `next/root-params` : lancé par pnpm typecheck avant le type-check.
- **Observabilité** : `instrumentation.ts` (OpenTelemetry) pour tracer une génération de bout en bout, et `onRequestError` pour remonter les erreurs serveur.

**Points de vigilance**

- `next lint` n'existe plus depuis la v16 : ESLint (flat config) ou Biome se lancent directement.
- La 16.3 recommande d'**abandonner les anciennes « knowledge skills »** Next.js au profit du bloc `AGENTS.md` (`npx skills update` les retire).
- Rester sur la dernière version patch (16.3.6 au 22 septembre 2026, correctif de sécurité).

## Sources

Documentation officielle Next.js, version 16.3.x, consultée le 23 septembre 2026.

- [Next.js 16](https://nextjs.org/blog/next-16) · [Next.js 16.3](https://nextjs.org/blog/next-16-3) · [16.3 : Instant Navigations](https://nextjs.org/blog/next-16-3-instant-navigations) · [16.3 : AI Improvements](https://nextjs.org/blog/next-16-3-ai-improvements)
- [Security update du 22 septembre 2026 (16.3.6)](https://nextjs.org/blog/upcoming-nextjs-security-release-september-22-2026)
- [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes) · [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) · [next/root-params](https://nextjs.org/docs/app/api-reference/functions/next-root-params) · [Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache) · [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag) · [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation)
- [Forms with Server Actions](https://nextjs.org/docs/app/guides/forms) · [Data security](https://nextjs.org/docs/app/guides/data-security) · [after](https://nextjs.org/docs/app/api-reference/functions/after)
- [generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) · [opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) · [sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Error handling](https://nextjs.org/docs/app/getting-started/error-handling) · [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route) · [Font](https://nextjs.org/docs/app/api-reference/components/font)
- [TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript) · [MCP Server](https://nextjs.org/docs/app/guides/mcp)
