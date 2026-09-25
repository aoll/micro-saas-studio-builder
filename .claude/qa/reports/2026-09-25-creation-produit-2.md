# QA creation-produit — 2026-09-25 (passe 5, `qa1`, recheck de la passe 4)

## Environnement

| | |
|---|---|
| Commit | `a2223958807c1d9cf3f0ca9ff36c58772c2afbb7` (`integration/qa1`) — QA1-P4-E1 mergé (#71) |
| Base | celle de `DATABASE_URL` (`.env.local` du checkout principal), remise à l'état du seed avec `pnpm db:migrate && pnpm tsx scripts/reset-demo.ts` avant de commencer, et à nouveau en toute fin de passe |
| Serveur | `pnpm dev -p 3000` (setsid, groupe dans `dev.pgid`, arrêté par `kill -TERM -- -<pgid>`, port libéré, vérifié par `fuser`), `AI_MODE=mock`, `DEMO_MODE=false`, `BETTER_AUTH_URL=http://localhost:3000` — un seul lancement, aucun redémarrage |
| Outils | MCP next-devtools (`nextjs_index`, `get_errors`) · agent-browser 0.38.1 (sessions `qa-cp1` admin desktop, `qa-cp2` visiteur mobile 390×844) · curl (statuts HTTP, `<title>`, `<h1>`) · lecture de code (`product-form.tsx`, `step-nav.tsx`, `validation.ts`) pour confirmer la correction de B-P4-1 et documenter le nouveau constat |
| Personas | admin (`DEV_ADMIN`), visiteur anonyme (IP simulée du conteneur) |
| Focus | aucun (scénario `creation-produit` complet) |
| Mode | `complet` (demandé) |
| Recheck | `.claude/qa/reports/2026-09-25-creation-produit.md` (constat B-P4-1, corrigé par PR #71) |
| Artefacts | `/tmp/claude-0/-home-user-micro-saas-studio-builder/ca00102c-2a13-5e53-b9e7-506909884f1c/scratchpad/qa/2026-09-25-creation-produit-2/` (captures `*.png`, `dev.log`) |

## Synthèse

| BUG bloquant | BUG majeur | BUG mineur | MANQUE | À qualifier | PASS | NON TESTÉ |
|---|---|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 0 | 16 | 1 |

Les 16 étapes du scénario ont été jouées en profondeur (mode `complet`). B-P4-1
(passe 4) est **CORRIGÉ** : reproduit sur son cas d'origine (étapes 5→6 avec
`{{inconnu}}`) et sur un second déclencheur (clé dupliquée à l'étape 4), le
message d'erreur et le marqueur rouge du StepNav disparaissent bien dès que
« Suivant » revalide l'étape corrigée ; les erreurs d'une autre étape (slug
pris à l'étape 1, clé dupliquée à l'étape 4 avant correction) restent
affichées comme attendu. Non-régression de B-N1/B-N2 confirmée avec la
saisie manuelle uniquement (le rapport de la passe 4 avait déjà couvert
l'import). Un nouveau constat mineur (B-P5-1, message de validation non
traduit sur les champs numériques du pricing), sans rapport avec B-P4-1.

## Étapes

| Étape | Profondeur | Verdict | Raison | Constat |
|---|---|---|---|---|
| 1 | profondeur | PASS | `/admin/products/new` : 7 étapes à gauche (Identité → Récapitulatif), aperçu de la landing à droite, import JSON et champs Identité visibles | — |
| 2 | profondeur | PASS | « BioInsta » → slug proposé `bioinsta` (auto-dérivé), modifiable en `bio-instagram` ; statut initial Test ; langue changée en English sans blocage | — |
| 3 | profondeur | PASS | `lettre-pro` → « Ce slug est déjà utilisé », reste à l'étape 1 ; `admin` → « Ce slug est réservé », reste à l'étape 1 ; slug libre (`bio-instagram`) → « Suivant » avance à l'étape 2 | — |
| 4 | profondeur | PASS (voir aussi B-P4-1 recheck) | 4 vignettes (Corporate, Editorial, Neon, Playful) ; sélection de Neon → aperçu à jour immédiatement | — |
| 5 | profondeur | PASS | Titre, sous-titre, exemple de résultat, FAQ (ajout d'une question, remplie), meta title/description remplis à la main, compteur de caractères présent | — |
| 6 | profondeur | PASS (voir aussi recheck B-N2) | 3 champs créés en saisie manuelle (`niche` text, `highlights` textarea, `tone` select playful/professional) ; « Monter »/« Descendre » réordonnent correctement (vérifié aller-retour) ; clé dupliquée (`tone` → `niche`) → « Clé déjà utilisée », bloqué à l'étape 4, aucune erreur console « two children with the same key » | — |
| 7 | profondeur | PASS (voir aussi recheck B-N1, B-P4-1) | Ajouter `{{inconnu}}` au template → « Variable {{inconnu}} sans champ correspondant », bloqué à l'étape 5 ; le retirer → « Suivant » avance à l'étape 6 sans erreur, avec les 3 vraies variables (`{{niche}}`, `{{highlights}}`, `{{tone}}`) | — |
| 8 | profondeur | PASS | « Tester le prompt » sans échantillon rempli → « Complétez les champs obligatoires de l'échantillon », pas de résultat ; échantillon rempli → `POST /admin/products/new` 200, résultat affiché avec tokens et coût (Q3 déjà écarté : rejoue la fixture par défaut, non recompté) | — |
| 9 | profondeur | PASS (nouveau constat B-P5-1) | 3 crédits offerts, 1 génération anonyme, coût 1, packs 10/4,90 € et 50/14,90 € (recommandé) ; marge par génération affichée (« $0.489090 » et « $0.297090 ») ; coût par génération à `-1` → refusé, reste à l'étape 6, mais le message affiché est le brut Zod « Too small: expected number to be >=1 », pas une traduction française | B-P5-1 |
| 10 | profondeur | PASS | Retour à l'étape 1 (StepNav) : Nom/Slug conservés ; retour à l'étape 6 : crédits, générations gratuites, coût et les 2 packs conservés — `<Activity>` garde l'état des étapes masquées | — |
| 11 | profondeur | PASS | « Enregistrer » → toast « Brouillon enregistré · version 1 », redirection `/admin/products/bio-instagram/edit` ; `/bio-instagram` déjà 200 avant Publier (Q1 déjà écarté, non recompté) | — |
| 12 | profondeur | PASS | Récapitulatif : Nom, Slug, Thème (Neon), 3 champs, 2 packs corrects ; « Publier » → toast « Produit publié · version 2 », lien fonctionnel vers `/bio-instagram` | — |
| 13 | profondeur | PASS | `/bio-instagram` (390×844) : landing en anglais (« Try it free », « Frequently asked questions »), `<title>AI Instagram Bio Generator</title>` dans le HTML initial (`curl`) ; thème Neon appliqué (vérifié par capture) | — |
| 14 | profondeur | PASS | `POST /bio-instagram/api/generate` → 200, résultat streamé affiché (copier/télécharger/regénérer), modale d'inscription (SA-03) ouverte automatiquement ensuite ; aucune erreur console, `get_errors` MCP vide | — |
| 15 | profondeur | PASS | `/admin/products/bio-instagram/edit` → modifier le headline → « Publier » (toast « Produit publié · version 3 ») → `/bio-instagram` montre le nouveau `<h1>` à la requête suivante (`curl`), `<title>` inchangé (non modifié dans ce test) ; `updateTag` confirmé | — |
| 16 | — | NON TESTÉ (nettoyage, pas un verdict de scénario) | BioInsta remis à l'état du seed par `reset-demo.ts` en toute fin de passe (headline modifié à l'étape 15 non restauré manuellement, puisque le reset l'efface de toute façon) | — |
| Portefeuille (BO-02, pendant l'étape 16) | régression légère | PASS | `/admin` : BioInsta présent, statut Test, sans badge (1 visite, largement sous 1 000, conforme BO-02 § 3) | — |

## Recheck (rapport `2026-09-25-creation-produit.md`)

| # | Titre | Verdict | Détail |
|---|---|---|---|
| B-P4-1 | Étapes 4/5 (BO-05) : message d'erreur et marqueur StepNav périmés après une revisite d'étape valide | **CORRIGÉ** | Reproduit deux fois, avec preuve de non-régression sur les erreurs des autres étapes : (1) Étape 5 → ajouter `{{inconnu}}` (bloque, PASS), le retirer, « Suivant » → avance à l'étape 6 sans erreur ; revenu à l'étape 5 **via StepNav** → aucun message d'erreur affiché, et `Array.from(document.querySelectorAll('nav[aria-label="Étapes du formulaire"] button')).map(b => b.dataset.hasError)` renvoie `ok` pour les 7 onglets (capture `step5-revisit-clean.png`). (2) Étape 4 → clé dupliquée (`tone` → `niche`), bloqué (« Clé déjà utilisée », PASS) ; clé corrigée puis « Suivant » cliqué avec succès (avance à l'étape 5) → le StepNav reste entièrement `ok`, aucune trace de rouge résiduel. Contre-preuve (l'erreur d'une autre étape doit rester affichée) : au moment même où `{{inconnu}}` bloquait l'étape 5, l'étape 1 n'avait plus d'erreur active (slug déjà validé) — testé séparément en laissant le slug `lettre-pro` en échec à l'étape 1 : le message « Ce slug est déjà utilisé » reste affiché tant que « Suivant » n'est pas recliqué avec un slug valide, cohérent avec le fonctionnement de `handleNext` (purge uniquement les erreurs de l'étape courante). Lu dans le code : `product-form.tsx` › `handleNext()` reconstruit désormais `errors` en retirant toutes les clés dont `stepOfPath(path) === currentStep` avant d'y remettre le résultat de `validateStep`, avec le commentaire explicite « QA1-P4-E1 … drop every stale error that belongs to the current step ». |

## Constats

### B-P5-1 · Étape 6 (Pricing) : message de validation numérique non traduit — BUG mineur

- **Étape** : 9
- **Référence** : `docs/01-produit.md` › Configuration d'un produit, tableau « Bloc du formulaire », ligne Pricing › Contrôle « Valeurs positives » · `specs/BO-05b-generation-publication.md` › Acceptation 3 (« Étape 6 : … marge estimée affichée ») · `docs/01-produit.md` › Architecture technique (« Backoffice reste en français ») · `specs/BO-05a-formulaire.md` › « Erreurs affichées à l'étape concernée »
- **Repro** :
  1. `/admin/products/new`, admin connecté, arrivé à l'étape 6 « Pricing » (n'importe quel produit en cours de création).
  2. Mettre `-1` dans le champ « Coût par génération (crédits) ».
  3. Cliquer « Suivant ».
- **Attendu** : la valeur négative est refusée (« Suivant » ne passe pas l'étape en erreur, comportement voulu, docs/01 › Contrôle « Valeurs positives ») avec un message d'erreur en français, cohérent avec le reste du backoffice.
- **Observé** : la valeur est bien refusée (reste à l'étape 6, marge affichée devient négative dans l'aperçu : « marge -$0.490910 par génération »), mais le message affiché sous le champ est le texte brut de Zod en anglais : « Too small: expected number to be >=1 », au lieu d'un message français comme pour les autres champs (« Ce champ est requis », « Ce slug est réservé »…).
- **Preuve** : capture `pricing-negative-error.png` ; `agent-browser eval` confirme le texte exact `"Too small: expected number to be >=1"` affiché dans un `<p>` sous le spinbutton ; lecture de code : `lib/schemas/product-config.ts:95` déclare `costPerGeneration: z.int().min(1)` sans message personnalisé, et `app/(backoffice)/admin/products/_components/product-form/validation.ts` › `toFrenchMessage()` ne traduit `too_small` que pour `issue.origin === "string"` (longueur de texte) : un `too_small` d'origine `"number"` (min d'un entier) tombe dans le `return FRENCH_MESSAGES[issue.message] ?? issue.message` final, qui n'a pas d'entrée pour ce message et renvoie donc le texte anglais de Zod tel quel. Le même schéma s'applique à `freeCreditsOnSignup`, `anonymousFreeGenerations`, ainsi qu'aux `credits`/`priceCents` de chaque pack (`packSchema`), qui utilisent probablement le même pattern `z.int().min(…)` et seraient donc affectés de la même façon (non vérifié individuellement dans cette passe, seul `costPerGeneration` a été reproduit).
- **Fichiers de la route** : `app/(backoffice)/admin/products/_components/product-form/validation.ts` (`toFrenchMessage`), `lib/schemas/product-config.ts` (`pricingSchema`)
- **Serveur ou UI** : affichage (la validation elle-même est correcte côté client comme côté schéma partagé ; seul le message n'est pas traduit)
- **Sévérité** : mineur — ne bloque ni la création ni la publication du produit (l'admin corrige la valeur et avance normalement), mais expose un message d'erreur en anglais dans un backoffice entièrement en français, ce qui peut surprendre pendant une démo si un chiffre négatif ou nul est saisi par erreur dans le pricing.

## Nettoyage

BioInsta (créé en saisie manuelle, enregistré en brouillon, publié, puis republié avec un headline modifié pour la vérification de `updateTag`) supprimé par `pnpm tsx scripts/reset-demo.ts` exécuté en toute fin de passe ; portefeuille revenu à l'état du seed (LettrePro, DescriPro, NomDeMarque). Serveur arrêté par son groupe (`kill -TERM -- -<pgid>`), port 3000 libéré (vérifié par `fuser`).

## Outils réellement utilisés

- MCP `next-devtools` : `nextjs_index`, `get_errors` (après le parcours complet et après le recheck de B-P4-1)
- `agent-browser` 0.38.1 : sessions `qa-cp1` (admin, desktop, formulaire création/édition, portefeuille) et `qa-cp2` (visiteur anonyme, mobile 390×844, landing et outil) ; `snapshot`, `fill`, `select`, `click`, `eval`, `console`, `errors`, `network requests`, `screenshot`
- `curl` : statuts HTTP et contenu HTML (`<title>`, `<h1>`) de `/bio-instagram` avant/après publication et édition
- Lecture de code : `product-form.tsx` (`handleNext`, `stepPatch`), `step-nav.tsx`, `validation.ts` (`toFrenchMessage`, `validateStep`), `lib/schemas/product-config.ts` (`pricingSchema`) pour confirmer la correction de B-P4-1 et documenter la cause de B-P5-1
- `pnpm tsx scripts/reset-demo.ts`, `pnpm db:migrate`
- Lecture complète de `docs/` (00 à 13), `specs/README.md`, toutes les specs `BO-*`/`SA-*`/`CONTRACT-*`/`LEDGER`/`TRACKING`/`SECURITY`/`DEMO-mode`/`I18N-SEO`/`E2E-demo`/`SETUP-skeleton`/`TOOLING-test-transaction`, et `specs/qa/*.md`

## Décision

Validée par l'humain le 2026-09-25 (« Fixe aussi »).

| Constat | Décision | Spec de correction |
|---|---|---|
| B-P5-1 | corriger | `specs/qa/QA1-P5-E2-messages-numeriques.md` |
