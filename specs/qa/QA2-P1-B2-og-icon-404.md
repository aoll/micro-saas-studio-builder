# QA2-P1-B2 · Les images OG et l'icône par produit renvoient 404 en production
Réf         : .claude/qa/reports/2026-09-27-full.md › B2 (validé par l'humain le 2026-09-27)
              · specs/I18N-SEO.md › Acceptation (« opengraph-image.tsx et icon.tsx par
              produit, aux couleurs du thème ») · docs/04-nextjs.md § 201-202, 225-226

Contrat     : aucun changement de contrat gelé attendu (pas de `lib/db/schema.ts`, pas de
              `lib/schemas/**`, pas de signature DAL) — sauf si l'investigation ci-dessous
              montre le contraire, auquel cas s'arrêter et remonter à l'humain avant de
              continuer (règle du flux `orchestrator` : un contrat gelé hors spec CONTRACT
              ne se change pas sans son accord explicite).

Dépend de   : —

Acceptation :
- Repro (constaté sur `https://micro-saas-studio-builder.vercel.app`, reproductible sur les
  3 produits vivants du seed) :
  1. `curl -I https://micro-saas-studio-builder.vercel.app/lettre-pro/opengraph-image`
  2. `curl -I https://micro-saas-studio-builder.vercel.app/lettre-pro/icon`
  3. Répéter pour `descri-pro` et `nom-de-marque`.
  - Attendu : PNG 1200×630 (OG) et 32×32 (icône), aux couleurs du thème du produit.
  - Observé : 404 (`content-type: text/html`) pour les deux routes, sur les 3 produits,
    reproductible sur 3 tentatives consécutives par route (18/18 réponses 404).
- **Indice clé pour la cause racine** (à vérifier en premier, avant toute hypothèse) :
  `https://micro-saas-studio-builder.vercel.app/lettre-pro` (la landing elle-même, sous le
  même segment dynamique `[app]`, avec le même `generateStaticParams` que
  `[app]/layout.tsx`) répond 200 sur ce même déploiement — donc ce n'est *pas* un instantané
  de base au moment du build qui manquerait ces slugs (sinon la landing 404erait aussi). Le
  problème est spécifique aux fichiers spéciaux `opengraph-image.tsx`/`icon.tsx` et à leur
  propre `generateStaticParams`, pas aux slugs eux-mêmes ni à `listProductSlugs()`. Comparer
  précisément ce qui diffère entre `[app]/layout.tsx` (qui fonctionne) et
  `[app]/opengraph-image.tsx`/`[app]/icon.tsx` (qui échouent) : `dynamicParams` implicite,
  interaction de ces conventions spéciales avec Cache Components (docs/04-nextjs.md note
  qu'« opengraph-image et sitemap sont des Route Handlers spéciaux, mis en cache par
  défaut » — vérifier si cette phrase est encore vraie pour la version de Next.js installée,
  via `docs/04-nextjs.md`/AGENTS.md ou la doc Next.js elle-même), runtime déclaré
  (edge/nodejs) different de celui de la page, ou tout autre comportement documenté propre
  à ces conventions sous Next.js 16.3.
- Une fois la cause racine identifiée et corrigée : les deux routes répondent 200 avec le
  bon `content-type`, `content-length` cohérent avec une image, pour les 3 produits vivants
  du seed, en local (`pnpm dev`) et vérifié par un test qui échoue avant la correction et
  passe après (pas seulement un test qui appelle directement le composant : le bug de cette
  passe n'était visible qu'au niveau du déploiement/routing, donc si un test Vitest du
  composant seul ne suffit pas à reproduire le 404, ajouter un test `e2e/seo.spec.ts` qui
  requête réellement ces deux routes).
- Un produit `killed` continue de répondre 404 sur les deux routes (comportement déjà
  correct et volontaire, ne pas régresser).
- Un slug inconnu continue de répondre 404 sur les deux routes (déjà correct, ne pas
  régresser).

Périmètre   : `app/(products)/[app]/opengraph-image.tsx`, `app/(products)/[app]/icon.tsx`,
              `app/(products)/[app]/layout.tsx` (lecture seule, pour comparaison — n'y
              toucher que si la cause racine l'exige explicitement),
              `app/(products)/[app]/_lib/og-colors.ts`,
              `app/(products)/[app]/opengraph-image.test.tsx`,
              `app/(products)/[app]/icon.test.tsx`, `e2e/seo.spec.ts`.

Hors périmètre : les autres constats du rapport (B1, B3, B4) ; toute modification de
              `lib/dal/products.ts` (`getProduct`, `listProductSlugs`) sauf preuve concrète
              qu'elle est la cause racine (l'indice ci-dessus l'exclut a priori, puisque la
              landing qui utilise les mêmes fonctions fonctionne) ; le contenu visuel des
              images (couleurs, layout) au-delà de ce qui est déjà spécifié.
