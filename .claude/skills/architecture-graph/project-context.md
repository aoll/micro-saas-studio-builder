Contexte à coller dans chaque prompt de dispatch (file-analyzer,
architecture-analyzer, tour-builder) — évite de le redécrire à chaque fois.

- **Nom** : micro-saas-studio-builder
- **Description** : Backoffice Next.js 16 (App Router, TypeScript strict)
  pour un "SaaS studio" qui lance des micro-SaaS IA à crédits en quelques
  minutes et les pilote par la donnée (statuts Test/Learn/Scale/Killed).
  Deux zones distinctes : le backoffice admin (route group `(backoffice)`)
  et les sub-apps produit servies sur `/{slug}` (route group
  `(products)/[app]`).
- **Frameworks/libs** : Next.js 16 App Router, React 19, TypeScript strict,
  Tailwind v4 + shadcn/ui, Drizzle ORM + Postgres, Better Auth, AI SDK
  (Vercel), next-intl, Zod, Vitest, Playwright.
- **Arborescence de premier niveau** : `app/` (routes, sous-groupes
  `(backoffice)/`, `(products)/`, `api/`), `lib/` (`dal/`, `db/`,
  `schemas/`, `ai/`), `components/` (`backoffice/`, `product/`, `ui/`,
  `shared/`), `i18n/`, `drizzle/` (migrations SQL, exclu du scope — voir
  `.understandignore`), `scripts/`, `docs/`, `e2e/`, `fixtures/`, config
  racine (`package.json`, `next.config.ts`, `tsconfig.json`, etc.).
- **Zones archi** (pour l'architecture-analyzer — à confirmer à chaque run,
  pas à recopier aveuglément) : `app/(backoffice)/` = backoffice admin
  (portefeuille, fiche produit, formulaire de création, thèmes, réglages) ;
  `app/(products)/[app]/` = sub-app publique par produit (landing, outil IA,
  paiement simulé, inscription, historique, compte). `lib/dal/` = seul code
  qui touche la base. `lib/ai/` = appels IA. `components/ui/` = primitives
  shadcn. `components/product/` et `components/backoffice/` = composants
  partagés propres à chaque zone. Lors de la dernière analyse (27/09/2026),
  `app/(backoffice)` et `app/(products)` ne s'importaient l'un l'autre que 2
  fois sur 654 arêtes d'import — quasi-isolation confirmée, deux couches
  séparées.
- **Pour le tour-builder** : point d'entrée pédagogique conseillé —
  `README.md`/`docs/00-accueil.md` (vue d'ensemble), puis montrer la
  séparation backoffice/produit, le point d'entrée de chaque zone, la DAL,
  l'IA, le système de crédits, avant les couches transverses (schemas, UI
  partagée, tooling). En français.
