# QA2-P1-B1 · Un nouveau produit est déjà en ligne dès le premier « Enregistrer »
Réf         : .claude/qa/reports/2026-09-27-full.md › B1 (validé par l'humain le 2026-09-27)
              · specs/BO-05a-formulaire.md › Acceptation (« Enregistrer → nouvelle ligne
              product_versions, jamais de mise à jour en place, brouillon non publié »)
              · specs/BO-05b-generation-publication.md › Acceptation étape 7
              · scénario `.claude/skills/qa/scenarios/full.md` § 3.9

Contrat     : **CONTRACT** — `lib/db/schema.ts` › table `products` : `current_version`
              devient nullable (aujourd'hui `integer("current_version").notNull()` avec
              `check products_current_version_positive (current_version >= 1)`). Nouveau
              sens : `current_version IS NULL` signifie « produit jamais publié ». Migration
              Drizzle requise (`current_version` sans `.notNull()`, contrainte remplacée par
              `current_version IS NULL OR current_version >= 1`). Le reste du contrat
              `productConfig` (Zod) et les signatures DAL (`createProduct`, `saveVersion`,
              `publishProduct`, `getProductDraft`) restent byte-identiques ; seul le type de
              retour de `getProductDraft` change : `publishedVersion: number` devient
              `publishedVersion: number | null`.

Dépend de   : —

Acceptation :
- Cause racine (confirmée en lisant `lib/dal/product-editor.ts:16-38`) : `createProduct()`
  insère la ligne `products` avec `currentVersion: 1` directement au lieu de la laisser
  `null` tant qu'aucune publication n'a eu lieu — contrairement à `saveVersion()` (édition
  d'un produit existant) qui ne touche jamais `current_version` et se comporte déjà
  correctement.
- Repro (devient le comportement attendu, vérifiable par un test) :
  1. `/admin/products/new`, remplir toutes les étapes d'un nouveau produit.
  2. Cliquer « Enregistrer » (jamais « Publier »).
  3. Ouvrir `/<slug>` sans session.
  - Attendu : `/<slug>` répond 404 (SA-08), comme n'importe quel slug jamais publié — le
    toast dit lui-même « Brouillon enregistré ». Aujourd'hui : 200, la landing complète est
    servie dès le premier « Enregistrer ».
- `listProducts()` (portfolio BO-02, sitemap, « nos autres outils » SA-08, `theme-usage`)
  n'inclut jamais un produit jamais publié : la jointure `INNER JOIN` sur
  `product_versions.version = products.current_version` l'exclut déjà naturellement une
  fois `current_version` nullable (vérifier avec un test, pas seulement supposer).
- `getProduct(slug)` (route publique) retourne `null` pour un produit dont
  `current_version` est `null`, au lieu de jeter une erreur (aujourd'hui : `if (!version)
  throw new Error(...)`, correct seulement pour une vraie incohérence de données, pas pour
  ce nouvel état légitime « jamais publié »).
- `getProductDraft(slug)` (page d'édition BO-05a) retourne `publishedVersion: null` pour un
  produit jamais publié ; `admin/products/[slug]/edit/page.tsx` et
  `product-form.tsx` (déjà avec `publishedVersion?: number`, ligne 84 et le test
  `!== undefined` ligne 327) affichent alors seulement « brouillon vN », sans le
  « · en ligne vM » (vérifier ce champ précisément à l'écran, pas seulement dans la
  fonction qui le produit — un produit jamais publié ET un produit publié doivent tous les
  deux rester corrects après ce changement, y compris la republication normale d'un
  produit existant, non régressée).
- Toute lecture de `products.currentVersion`/`current_version` ailleurs (grep avant de
  commencer : `lib/dal/metrics.ts`, `lib/dal/credits.ts`, et tout autre fichier hors
  `**/*.test.ts*` que `git grep -n "currentVersion\|current_version"` trouve dans
  `app/`, `lib/`, `scripts/seed.ts`) continue de fonctionner sans lancer d'exception pour
  un produit jamais publié : soit ce cas ne peut pas s'y produire (aucune génération, aucun
  crédit, aucune métrique n'existe pour un produit que personne n'a jamais vu), soit le
  code le gère explicitement. Documenter dans le plan lequel des deux pour chaque fichier
  trouvé.
- Le seed (`scripts/seed.ts`) et tout produit existant déjà publié ne changent pas de
  comportement (migration additive, aucune donnée existante ne devient `NULL`).

Périmètre   : `lib/db/schema.ts` (+ migration Drizzle dans `drizzle/`),
              `lib/dal/product-editor.ts` (`createProduct`, `getProductDraft`),
              `lib/dal/products.ts` (`getProduct`, `listProducts`),
              `lib/dal/metrics.ts`, `lib/dal/credits.ts` (si `git grep` y trouve
              `current_version`/`currentVersion`),
              `admin/products/[slug]/edit/page.tsx`,
              `admin/products/_components/product-form/product-form.tsx` (type seulement,
              déjà optionnel côté props),
              `e2e/product-form.spec.ts`, `e2e/publish.spec.ts` (étendre si un parcours e2e
              est le seul endroit qui montre le bug dans un navigateur).

Hors périmètre : les autres constats du rapport (B2, B3, B4) ; toute UI listant les
              brouillons jamais publiés dans le portfolio (non demandé par l'acceptation
              d'origine de BO-05a, qui ne couvre que « Enregistrer → brouillon non publié »
              côté route publique) ; le flux `publish` (`createProduct` + `publishProduct`
              en séquence) qui fonctionne déjà correctement et ne doit pas changer de
              comportement observable.
