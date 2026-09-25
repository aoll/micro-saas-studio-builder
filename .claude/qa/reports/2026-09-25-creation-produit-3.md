# QA creation-produit — 2026-09-25 (passe 6, `qa1`, recheck de la passe 5)

## Environnement

| | |
|---|---|
| Commit | `e32083c39637dd61aaa100a048b1180ef21579aa` (`integration/qa1`) — QA1-P5-E2 mergé (#72) |
| Base | celle de `DATABASE_URL` (`.env.local` du checkout principal), remise à l'état du seed avec `pnpm db:migrate && pnpm tsx scripts/reset-demo.ts` avant de commencer, et à nouveau en toute fin de passe |
| Serveur | `pnpm dev -p 3000` (setsid, groupe dans `dev.pgid`, arrêté par `kill -TERM -- -<pgid>`, port libéré, vérifié par `fuser`), `AI_MODE=mock`, `DEMO_MODE=false`, `BETTER_AUTH_URL=http://localhost:3000` — un seul lancement, aucun redémarrage |
| Outils | MCP next-devtools (`nextjs_index`, `get_errors`) · agent-browser 0.38.1 (sessions `qa-cp3` admin desktop, `qa-cp4-visitor` visiteur mobile 390×844) · curl (statuts HTTP, `<title>`, `<h1>`) · lecture de code (`pricing-step.tsx`, `validation.ts`, `margin.ts`, `pricing-step.test.tsx`, `product-config.ts`, `pack.ts`) pour confirmer/infirmer la correction de B-P5-1 et documenter le nouveau constat |
| Personas | admin (`DEV_ADMIN`), visiteur anonyme (IP simulée du conteneur) |
| Focus | aucun (scénario `creation-produit` complet) |
| Mode | `complet` (demandé) |
| Recheck | `.claude/qa/reports/2026-09-25-creation-produit-2.md` (constat B-P5-1, « corrigé » par PR #72) |
| Artefacts | `/tmp/claude-0/-home-user-micro-saas-studio-builder/ca00102c-2a13-5e53-b9e7-506909884f1c/scratchpad/qa/2026-09-25-creation-produit-3/` (captures `*.png`, `dev.log`) |

## Synthèse

| BUG bloquant | BUG majeur | BUG mineur | MANQUE | À qualifier | PASS | NON TESTÉ |
|---|---|---|---|---|---|---|
| 0 | 1 | 1 | 0 | 0 | 16 | 0 |

Les 16 étapes du scénario ont été jouées en profondeur (mode `complet`).
B-P5-1 (passe 5) est **partiellement CORRIGÉ** : le cas d'origine exact
(`costPerGeneration` à -1) affiche désormais bien « Minimum : 1 » en
français, et les autres formats attendus par la spec de correction
(QA1-P5-E2) sont confirmés au niveau du moteur de traduction
(`toFrenchMessage`) et reproduits en direct dans le navigateur : « Minimum :
1 » (entier ≥ 1), « Doit être un nombre entier » (1.5 sur un champ entier).
Mais la spec demandait explicitement « même règle pour chaque champ
numérique du formulaire (crédits offerts à l'inscription, générations
gratuites anonymes, crédits et prix des packs…) », et en repoussant le test
à ces autres champs, un nouveau bug est apparu : **trois champs numériques
sur cinq n'affichent tout simplement aucun message d'erreur** (ni français
ni anglais), alors qu'ils bloquent bien « Suivant » — un recul par rapport
au bug d'origine, qui au moins affichait *un* message (en anglais). C'est
consigné comme nouveau constat B-P6-1 (majeur), avec un sous-effet mineur
(marge « $Infinity ») en annexe du même constat. Non-régression de B-P4-1
confirmée (StepNav sans marqueur d'erreur résiduel après correction de
chaque étape visitée : `{{inconnu}}` à l'étape 5, clé dupliquée à l'étape
4). Le reste du scénario (slug, thème, landing, champs, prompt, test du
prompt, pricing valide, enregistrement, publication, sub-app fr/en,
génération gratuite, inscription, édition, portefeuille) est PASS, sans
régression détectée.

## Étapes

| Étape | Profondeur | Verdict | Raison | Constat |
|---|---|---|---|---|
| 1 | profondeur | PASS | `/admin/products/new` : 7 étapes à gauche (Identité → Récapitulatif), aperçu de la landing à droite, import JSON et champs Identité visibles | — |
| 2 | profondeur | PASS | « BioInsta » → slug proposé `bioinsta` (auto-dérivé), modifié en `bio-instagram` ; statut initial Test ; langue changée en English sans blocage | — |
| 3 | profondeur | PASS | `lettre-pro` → « Ce slug est déjà utilisé », reste à l'étape 1 ; `admin` → « Ce slug est réservé », reste à l'étape 1 ; slug libre (`bio-instagram`) → « Suivant » avance à l'étape 2 | — |
| 4 | profondeur | PASS | 4 vignettes (Corporate, Editorial, Neon, Playful, vérifiées par `eval`) ; sélection de Neon → aperçu à jour immédiatement | — |
| 5 | profondeur | PASS | Titre, sous-titre, exemple de résultat, FAQ (question ajoutée et remplie), meta title/description remplis à la main, compteur de caractères présent (« 26 / 60 », « 101 / 160 ») | — |
| 6 | profondeur | PASS | 3 champs créés en saisie manuelle (`niche` text, `highlights` textarea requis, `tone` select playful/professional requis) ; « Monter »/« Descendre » réordonnent correctement (aller-retour vérifié) ; clé dupliquée (`tone` → `niche`) → « Clé déjà utilisée », bloqué à l'étape 4, aucune erreur console « two children with the same key » (B-N2, non régressé) | — |
| 7 | profondeur | PASS | Ajouter `{{inconnu}}` au template → « Variable {{inconnu}} sans champ correspondant », bloqué à l'étape 5 ; le retirer → « Suivant » avance à l'étape 6 sans erreur | — |
| 8 | profondeur | PASS | « Tester le prompt » avec échantillon rempli → `POST /admin/products/new` 200, résultat affiché avec tokens et coût (Q3 déjà écarté : rejoue la fixture par défaut, non recompté) | — |
| 9 | profondeur | PASS (voir aussi B-P5-1 recheck et nouveau constat B-P6-1) | `costPerGeneration` à -1 → « Minimum : 1 » (français, corrigé) ; à 1.5 → « Doit être un nombre entier » ; `freeCreditsOnSignup` à -1, `anonymousFreeGenerations` à -1, un pack à crédits 0 et à prix 0 → bloquent tous « Suivant » mais **n'affichent aucun message** ; pack à 0 crédit → marge affichée « $Infinity » | B-P6-1 |
| 10 | profondeur | PASS | Retour à l'étape 1 puis à l'étape 6 via StepNav : valeurs conservées (`<Activity>`) | — |
| 11 | profondeur | PASS | « Enregistrer » → redirection `/admin/products/bio-instagram/edit`, toutes les valeurs saisies conservées ; `/bio-instagram` déjà 200 avant Publier (Q1 déjà écarté, non recompté) | — |
| 12 | profondeur | PASS | Récapitulatif : Nom, Slug, Thème (Neon), 3 champs, 2 packs corrects ; « Publier » → « Produit publié · version 2 », lien fonctionnel vers `/bio-instagram` ; StepNav sans marqueur d'erreur résiduel en arrivant au récapitulatif (non-régression B-P4-1) | — |
| 13 | profondeur | PASS | `/bio-instagram` (390×844) : landing en anglais (« Try it free », « Frequently asked questions »), `<title>AI Instagram Bio Generator</title>` dans le HTML initial (`curl`), thème Neon (capture) | — |
| 14 | profondeur | PASS | `POST /bio-instagram/api/generate` → 200, résultat streamé (Copy/Download/Regenerate) puis modale d'inscription ouverte automatiquement, en anglais, thème Neon ; aucune erreur console, `get_errors` MCP vide | — |
| 15 | profondeur | PASS | `/admin/products/bio-instagram/edit` → headline modifié → étapes 2 à 7 traversées sans erreur résiduelle au StepNav → « Publier » (« Produit publié · version 3 ») → `/bio-instagram` montre le nouveau `<h1>` à la requête suivante (`curl`), `updateTag` confirmé | — |
| 16 | légère | PASS | `/admin` : BioInsta présent, statut Test, sans badge (1 visite, très sous 1 000) | — |

## Recheck (rapport `2026-09-25-creation-produit-2.md`)

| Constat précédent | Verdict | Preuve ou raison | Nouveau constat |
|---|---|---|---|
| B-P5-1 (2026-09-25-creation-produit-2) | **CORRIGÉ** (partiel — voir B-P6-1) | Reproduit sur son cas d'origine exact : étape 6, `costPerGeneration` à -1 puis « Suivant » → le champ affiche désormais « Minimum : 1 » (capture non prise, texte lu directement dans le snapshot d'accessibilité, `paragraph` sous le spinbutton), et non plus le brut Zod « Too small: expected number to be >=1 ». `1.5` sur ce même champ → « Doit être un nombre entier ». Lu dans le code (`validation.ts` › `toFrenchMessage`) : la branche `too_small`/`origin: "number"` et `invalid_type`/`expected: "int"` sont bien ajoutées et couvrent tout `z.int().min(…)` ou `.positive()` du schéma, y compris `freeCreditsOnSignup`, `anonymousFreeGenerations` et les packs. Le moteur de traduction est donc corrigé pour **tous** les champs, conformément à l'acceptation de QA1-P5-E2. En revanche, en testant ces autres champs dans le navigateur (comme demandé par cette passe), ils ne remontent **aucun** message à l'écran : `PricingStep` (le composant React) ne lit `errors["pricing.costPerGeneration"]` que pour ce seul champ, et n'a jamais été câblé pour lire `errors["pricing.freeCreditsOnSignup"]`, `errors["pricing.anonymousFreeGenerations"]`, `errors["pricing.packs.{i}.credits"]` ni `errors["pricing.packs.{i}.priceCents"]` (seul `errors["pricing.packs.{i}.id"]` y est branché). Le bug d'origine (message anglais) est corrigé ; un bug de portée plus large apparaît en creux et est consigné en B-P6-1. | B-P6-1 |

## Constats

### B-P6-1 · Pricing : quatre champs numériques bloquent « Suivant » sans jamais afficher de message d'erreur — BUG majeur

- **Étape** : 9
- **Référence** : `specs/qa/QA1-P5-E2-messages-numeriques.md` › Acceptation 2 (« Même règle pour chaque champ numérique du formulaire (crédits offerts à l'inscription, générations gratuites anonymes, crédits et prix des packs, et tout autre `z.int()`/`z.number()` borné du schéma) ») · `specs/BO-05a-formulaire.md` › « Erreurs affichées à l'étape concernée » · `docs/01-produit.md` › Configuration d'un produit, tableau « Bloc du formulaire », ligne Pricing › Contrôle « Valeurs positives »
- **Repro** :
  1. `/admin/products/new`, admin connecté, arrivé à l'étape 6 « Pricing » (n'importe quel produit en cours de création, packs par défaut présents).
  2. Mettre `-1` dans « Crédits offerts à l'inscription » (`#pricing-free-credits`), cliquer « Suivant ». Constater : l'étape reste bloquée (le formulaire n'avance pas), mais **aucun** texte d'erreur n'apparaît sous le champ, et `aria-invalid` n'est jamais posé (`document.getElementById('pricing-free-credits').getAttribute('aria-invalid')` → `null`).
  3. Même chose avec `-1` dans « Générations anonymes gratuites » (`#pricing-anonymous-generations`).
  4. Même chose avec `0` dans « Crédits » d'un pack (`#pricing-pack-credits-0`) : bloqué, sans message, et en prime la ligne « marge » de ce pack affiche `4,90 € · marge $Infinity par génération` (division par zéro dans `revenuePerGenerationMicros`, `priceCents / pack.credits`).
  5. Même chose avec `0` dans « Prix (€) » d'un pack (`#pricing-pack-price-0`) : bloqué, sans message.
- **Attendu** : comme pour `costPerGeneration` (corrigé par PR #72) et comme le demande explicitement l'acceptation 2 de QA1-P5-E2, chacun de ces quatre champs doit afficher un message français sous le champ concerné quand il est hors bornes (« Minimum : 0 » pour les deux premiers, « Doit être supérieur à 0 » pour les deux derniers, d'après `toFrenchMessage` et le schéma `pricingSchema`/`packSchema`).
- **Observé** : le formulaire bloque bien « Suivant » dans les quatre cas (la validation Zod/`validateStep` fonctionne, elle a été confirmée dans B-P5-1), mais l'admin ne voit **aucune indication de ce qui ne va pas** : pas de message, pas d'`aria-invalid`, rien dans la console. C'est un recul par rapport au bug d'origine B-P5-1, qui au moins affichait un message (en anglais) : ici, il n'y a plus de message du tout. Un admin qui saisit une valeur invalide dans un de ces quatre champs reste bloqué à l'étape 6 sans comprendre pourquoi, ce qui est trompeur en particulier pendant une démo.
- **Preuve** : `agent-browser eval` confirmant l'absence d'`aria-invalid` sur `#pricing-free-credits` et `#pricing-anonymous-generations` après un « Suivant » resté sans effet (toujours à l'étape 6, `data-has-error` du StepNav non posé) ; capture `09-pricing-missing-errors.png` (crédits/générations à -1, aucun texte rouge) et `10-pack-credits-zero-infinity.png` (pack à 0 crédit, « marge $Infinity par génération », sans message d'erreur sous le champ « Crédits ») ; lecture de code : `app/(backoffice)/admin/products/_components/product-form/pricing-step.tsx` n'affiche `errors[…]` que pour `pricing.costPerGeneration` (lignes 88-90) et `pricing.packs.{index}.id` (ligne 141-143) — jamais pour `pricing.freeCreditsOnSignup`, `pricing.anonymousFreeGenerations`, `pricing.packs.{index}.credits` ni `pricing.packs.{index}.priceCents`, alors que `validateStep`/`toFrenchMessage` (`validation.ts`) produit bien un message français pour chacun de ces chemins ; `pricing-step.test.tsx` n'a aucun test qui vérifie l'affichage d'un de ces quatre messages (seul `pricing.packs.0.id` y est testé), confirmant que le gap n'a pas été couvert par la spec de correction QA1-P5-E2. Le `$Infinity` vient de `margin.ts` › `revenuePerGenerationMicros` : `(pack.priceCents * MICROS_PER_CENT) / pack.credits`, non gardé contre `pack.credits === 0`.
- **Fichiers de la route** : `app/(backoffice)/admin/products/_components/product-form/pricing-step.tsx` (affichage des erreurs), `app/(backoffice)/admin/products/_components/product-form/margin.ts` (`revenuePerGenerationMicros`, division par zéro), `app/(backoffice)/admin/products/_components/product-form/validation.ts` (le message correct existe déjà côté logique)
- **Serveur ou UI** : affichage (la validation elle-même est correcte côté client comme côté schéma partagé ; seul l'affichage du message, et le calcul de marge en cas de crédits à 0, sont en cause)
- **Sévérité** : majeur — ne casse pas le script de démo (aucune perte de crédits/argent/données, et l'admin finit toujours par deviner qu'il faut remettre une valeur positive), mais une acceptation explicite de spec (QA1-P5-E2 › Acceptation 2) échoue sur 4 des 5 champs numériques qu'elle couvre, avec un blocage silencieux qui peut réellement dérouter un admin (ou un recruteur) pendant une démo en direct.

## Nettoyage

BioInsta (créé en saisie manuelle, enregistré en brouillon, publié deux fois — une pour la publication initiale, une après modification du headline pour vérifier `updateTag`) supprimé par `pnpm tsx scripts/reset-demo.ts` exécuté en toute fin de passe ; portefeuille revenu à l'état du seed (LettrePro, DescriPro, NomDeMarque). Serveur arrêté par son groupe (`kill -TERM -- -<pgid>`), port 3000 libéré (vérifié par `fuser`).

## Outils réellement utilisés

- MCP `next-devtools` : `nextjs_index`, `get_errors` (après le parcours complet, `sessionErrors: []` et `configErrors: []` en fin de passe)
- `agent-browser` 0.38.1 : sessions `qa-cp3` (admin, desktop, formulaire création/édition, portefeuille) et `qa-cp4-visitor` (visiteur anonyme, mobile 390×844, landing et outil) ; `snapshot`, `fill`, `select`, `click`, `eval`, `console`, `errors`, `network requests`, `screenshot`
- `curl` : statuts HTTP et contenu HTML (`<title>`, `<h1>`) de `/bio-instagram` avant/après publication et édition
- Lecture de code : `pricing-step.tsx`, `pricing-step.test.tsx`, `validation.ts` (`toFrenchMessage`, `validateStep`), `margin.ts` (`revenuePerGenerationMicros`, `formatUsd`), `lib/schemas/product-config.ts` (`pricingSchema`), `lib/schemas/pack.ts` (`packSchema`), `step-nav.tsx` (`data-has-error`) pour confirmer/infirmer B-P5-1 et documenter B-P6-1
- `pnpm tsx scripts/reset-demo.ts`, `pnpm db:migrate`
- Lecture complète de `docs/` (00 à 13), `specs/README.md`, toutes les specs `BO-*`/`SA-*`/`CONTRACT-*`/`LEDGER`/`TRACKING`/`SECURITY`/`DEMO-mode`/`I18N-SEO`/`E2E-demo`/`SETUP-skeleton`/`TOOLING-test-transaction`, et `specs/qa/*.md` (14 specs de correction des passes 1 à 5)

## Observation hors périmètre (non consignée en constat)

Le journal du serveur affiche une fois, au tout premier `GET /bio-instagram` juste après la publication initiale (produit encore non mis en cache statique), l'avertissement Next.js « Route "/[app]": Next.js encountered URL data in `generateMetadata()` … This route's metadata is blocked, but the rest of its content can be prefetched », pointant vers le fichier généré `opengraph-image--metadata.js`. `get_errors` du MCP ne le remonte pas (`sessionErrors: []`), l'avertissement ne réapparaît pas aux requêtes suivantes, et il concerne `I18N-SEO`/`opengraph-image.tsx`, hors du périmètre de B-P5-1 et de la non-régression demandée pour cette passe : signalé ici pour mémoire, non qualifié en BUG ou MANQUE faute d'investigation plus poussée.
