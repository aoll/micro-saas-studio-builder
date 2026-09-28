# I18N-BACKOFFICE-STRINGS · Traduction complète du backoffice
Réf         : Accueil › Les décisions clés · Produit › Contenu des produits seedés › Langues ·
              Stack › i18n › Backoffice · specs/I18N-BACKOFFICE.md (déjà mergée : cookie
              `admin_locale`, `NextIntlClientProvider` posé dans `app/(backoffice)/layout.tsx`,
              branche 0 explicite de `i18n/request.ts` pour les Server Actions)
Dépend de   : I18N-BACKOFFICE
Contrat     : chaque lot ci-dessous livre sa propre paire `messages/{fr,en}/backoffice-<lot>.json`
              (zone `backoffice-<lot>`, jamais un fichier partagé entre lots : c'est ce qui rend
              les 9 lots strictement disjoints et parallélisables). `i18n/request.ts` n'est PAS
              modifié par cette spec (le cookie et la branche 0 existent déjà) ; les composants
              clients qui invoquent une Server Action du backoffice lient sa locale courante
              (`useLocale()`) au `.bind(null, locale)` de l'action, qui appelle
              `getTranslations({ locale, namespace: "backoffice-<lot>" })` — jamais `app()` ni
              `cookies()` dans un fichier `_actions.ts` (les deux jettent en Server Action).

## Décisions de portée (tranchées ici, ne pas re-débattre par lot)

- **Vocabulaire dupliqué à harmoniser** : `Test`/`Learn`/`Scale`/`Killed` restent identiques en
  français et en anglais (déjà des emprunts anglais dans le texte français existant) — chaque lot
  qui les affiche les code en dur telles quelles ou dans sa propre clé, cohérence garantie par le
  fait que la valeur est indépendante de la langue. Le triptyque de zone de décision se traduit
  ainsi, à reprendre mot pour mot dans chaque lot concerné (3, et tout endroit qui le duplique) :
  « à couper » → `cut`, « à scaler » → `scale`, « zone neutre » → `neutral zone`. Pas de fichier
  de messages partagé entre lots pour ça : la petite duplication de ces ~8 mots dans 2-3 zones est
  acceptée pour garder les lots indépendants ; la revue de consolidation vérifie que toutes les
  occurrences utilisent exactement ces traductions.
- **Formatage des nombres et devises** : les appels codés en dur `new Intl.NumberFormat("fr-FR", …)`
  / `.toLocaleString("fr-FR")` (portfolio/format.ts, product-form/margin.ts, decision-gauge.tsx,
  settings/percent.ts, activity-format.ts pour les montants) passent désormais la locale
  courante : dans un composant, via `useFormatter()`/`getFormatter()` de next-intl quand c'est
  pratique, sinon en remontant la locale (`useLocale()` côté appelant) en paramètre de la
  fonction de formatage pure. Chaque lot fait ce changement dans ses propres fichiers seulement.
- **Pluriels et temps relatif** : `activity-format.ts` (achats) et `theme-usage.ts` (produits)
  passent en pluriel ICU (`{count, plural, one {…} other {…}}`). Le temps relatif abrégé
  (« à l'instant », « il y a X min/h/j ») se traduit en équivalents anglais idiomatiques via ICU
  select/plural, pas une simple interpolation calquée sur le français.
- **Server Actions** : chaque `_actions.ts` du périmètre reçoit `locale` en dernier paramètre de
  chaque fonction exportée invoquée par un formulaire ou bouton (jamais dans un `FormData`), lié
  côté client par le composant appelant. `require-admin-coverage.test.ts` vérifie que
  `requireAdmin()` reste le premier appel de chaque action : l'ajout de `getTranslations()` se
  fait après cette garde, jamais avant.
- **Explicitement hors périmètre, dans tous les lots** : les noms de modèles IA
  (`model-catalogue.ts`, noms propres), les noms de langue `Français`/`English` (endonymes,
  jamais traduits, cohérent avec `locale-switcher.tsx` déjà mergé), le contenu de graine par
  défaut d'un produit (`form-values.ts` : "Champ 1", template de prompt par défaut — c'est du
  contenu produit modifiable par l'admin, pas du chrome UI), `colorLabel()` de `theme-editor.tsx`
  qui devient une table statique de 16 libellés (clé de token → libellé fr/en) au lieu d'une
  dérivation dynamique du nom camelCase.
- **`components/backoffice/**` rentre dans le périmètre** (lot 0) malgré son exclusion initiale
  de l'audit : c'est le chrome partagé par tout le backoffice (nav, badges de statut, bouton de
  déconnexion), son commentaire actuel (« Backoffice stays in French… ») est explicitement
  obsolète et doit être retiré/reformulé par ce lot.

## Lots (Périmètre par lot, strictement disjoints)

| Lot | Domaine | Fichiers | Zone messages |
|---|---|---|---|
| 0 | Shell partagé | `components/backoffice/admin-sidebar.tsx`, `status-badge.tsx`, `sign-out-button.tsx` | `backoffice-shell` |
| 1 | Connexion, Portefeuille & Ops | `admin/login/page.tsx`, `login/_components/login-form.tsx`, `login/_actions.ts`, `admin/page.tsx`, `admin/loading.tsx`, `admin/_components/portfolio/{portfolio-view,portfolio-kpis,decision-badge,portfolio-table,portfolio-skeleton,format,rows,sort}.ts(x)`, `admin/ops/page.tsx`, `admin/ops/not-found.tsx`, `admin/ops/_actions.ts`, `admin/ops/_components/reset-form.tsx` | `backoffice-portfolio` |
| 2 | Fiche produit & Activité | `admin/products/[slug]/page.tsx`, `_components/{product-sheet-view,product-sheet-skeleton,product-tabs,sheet-header,sheet-kpis,funnel-card,trend-chart,sheet}.ts(x)`, `activity/page.tsx`, `activity/_components/{activity-header,activity-view,activity-skeleton,movements-card,purchases-card,generations-table,pagination-nav}.tsx`, `activity/_lib/{activity-format,pagination}.ts` | `backoffice-product-sheet` |
| 3 | Statut & Décision | `admin/products/[slug]/_actions.ts`, `_components/{decision-panel,decision-copy,decision-gauge,decision-gauge-data,status/status-change}.ts(x)` | `backoffice-decision` |
| 4 | Formulaire produit A (identité/thème/landing/champs/import) | `admin/products/new/page.tsx`, `admin/products/[slug]/edit/page.tsx`, `_components/product-form/{identity-step,theme-step,landing-step,fields-step,import-config-panel,import-config}.ts(x)` | `backoffice-product-form-a` |
| 5 | Formulaire produit B1 (coquille/génération/pricing) | `_components/product-form/{product-form,step-nav,generation-step,pricing-step}.tsx` | `backoffice-product-form-b1` |
| 6 | Formulaire produit B2 (récap/validation) + Server Actions | `admin/products/_actions.ts`, `_components/product-form/{summary-step,prompt-tester,landing-preview,validation}.ts(x)` | `backoffice-product-form-b2` |
| 7 | Thèmes | `admin/themes/page.tsx`, `_components/{theme-library,theme-card,theme-usage,landing-variant-labels}.ts(x)`, `admin/themes/[id]/page.tsx`, `[id]/_actions.ts`, `[id]/_components/{theme-editor-loader,theme-editor,theme-preview,usage-warning,theme-errors,font-labels}.ts(x)` | `backoffice-themes` |
| 8 | Seuils / Réglages | `admin/settings/page.tsx`, `loading.tsx`, `_actions.ts`, `_components/{settings-skeleton,settings-view,thresholds-settings,thresholds-form,validation,percent,preview}.ts(x)` | `backoffice-settings` |

`slugify.ts`, `form-values.ts` (hors les valeurs de graine, cf. ci-dessus), `margin.ts`,
`image-signature.ts`, `prompt-variables.ts`, `model-catalogue.ts`, `decision-gauge-data.ts`,
`settings-view.ts`, `percent.ts`, `preview.ts` : touchés seulement si un formatage de nombre y est
codé en dur (cf. décision ci-dessus), sinon inchangés.

Acceptation :
- Un admin dont le cookie `admin_locale=en` ne voit plus aucun texte français dans
  `/admin/**`, sauf les exclusions listées ci-dessus (modèles IA, endonymes de langue, contenu
  de graine produit) ; sans cookie, le rendu reste identique à l'état actuel (français)
- Les 4 statuts (`Test`/`Learn`/`Scale`/`Killed`) et le triptyque de zone de décision
  (`cut`/`scale`/`neutral zone`) sont traduits à l'identique partout où ils apparaissent (sidebar,
  badge, panneau de décision, jauge, formulaire) — aucune divergence entre lots
- `pnpm vitest run i18n/messages.test.ts` reste vert : chaque nouvelle zone
  `backoffice-<lot>` a des clés strictement identiques entre `fr` et `en`
- Les messages d'erreur/succès des 6 `_actions.ts` du périmètre (login, ops, products/[slug],
  products, settings, themes/[id]) respectent la locale explicite reçue en paramètre ; aucun
  n'appelle `app()` ni `cookies()` ; `require-admin-coverage.test.ts` reste vert (ordre d'appel
  de `requireAdmin()` inchangé)
- Les pluriels (achats, produits par thème) et le temps relatif de `activity-format.ts` sont
  corrects en anglais (pas un calque du français), testés dans leurs fichiers `_lib`/`.ts`
  respectifs
- Les nombres/devises affichés suivent la locale courante (plus de `"fr-FR"` codé en dur dans les
  fichiers touchés par un lot)
Périmètre   : la somme des 9 lots ci-dessus, plus `e2e/backoffice-locale.spec.ts` (étendu avec au
              moins une assertion de non-régression : une page de chaque lot rendue en `en`)
Hors périmètre : `i18n/request.ts`, `app/(backoffice)/layout.tsx`, le sélecteur lui-même
              (I18N-BACKOFFICE, déjà livrés) ; noms de modèles IA ; noms de langue Français/English
              (endonymes) ; contenu de graine produit (`form-values.ts`) ; toute migration de
              `lib/db/schema.ts` ; traduction des produits eux-mêmes (`(products)/[app]`)
