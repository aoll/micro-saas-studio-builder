# QA creation-produit — 2026-09-25 (passe 4, `qa1`)

## Environnement

| | |
|---|---|
| Commit | `eae66e1b9a4de55544b3247be131a2f5d95488c6` (`integration/qa1`) — F1 mergé (`specs/qa/QA1-P3-F1-formulaire-etapes-5-4.md`, fixe B-N1 et B-N2 de la passe 3) |
| Base | celle de `DATABASE_URL` (`.env.local` du checkout principal), remise à l'état du seed avec `pnpm db:migrate && pnpm tsx scripts/reset-demo.ts` avant de commencer, et à nouveau en toute fin de passe |
| Serveur | `pnpm dev -p 3000` (setsid, groupe dans `dev.pgid`, arrêté par `kill -TERM -- -<pgid>`, port libéré, vérifié par `fuser`), `AI_MODE=mock`, `DEMO_MODE=false`, `BETTER_AUTH_URL=http://localhost:3000` — un seul lancement, aucun redémarrage |
| Outils | MCP next-devtools (`nextjs_index`, `get_errors`) · agent-browser 0.38.1 (sessions `qa-cp1` admin desktop, `qa-cp2` visiteur mobile 390×844) · curl (statuts HTTP, `<title>`, contenu HTML) · lecture de code (`product-form.tsx`, `step-nav.tsx`, `validation.ts`, `generation-step.tsx`, `prompt-tester.tsx`) pour confirmer les fixes et la cause du nouveau constat |
| Personas | admin (`DEV_ADMIN`), visiteur anonyme (IP simulée du conteneur) |
| Focus | aucun (scénario `creation-produit` complet) |
| Mode | `complet` (demandé) |
| Recheck | `.claude/qa/reports/2026-09-25-full-3.md` (constats B-N1, B-N2) |
| Artefacts | `/tmp/claude-0/-home-user-micro-saas-studio-builder/ca00102c-2a13-5e53-b9e7-506909884f1c/scratchpad/qa/2026-09-25-creation-produit/` (captures `*.png`, `dev.log`) |

## Synthèse

| BUG bloquant | BUG majeur | BUG mineur | MANQUE | À qualifier | PASS | NON TESTÉ |
|---|---|---|---|---|---|---|
| 0 | 0 | 1 | 0 | 0 | 16 | 1 |

Les 16 étapes du scénario ont été jouées, en profondeur (mode `complet`),
plus une vérification du portefeuille (BO-02) faite en cours de route : 16
(nettoyage) est traitée comme faite en fin de passe (reset), pas comme un
verdict de scénario testé en soi. Un nouveau constat mineur (B-P4-1, StepNav
et messages d'erreur périmés après une revisite d'étape) ; aucune régression
sur le reste du parcours.

## Étapes

| Étape | Profondeur | Verdict | Raison | Constat |
|---|---|---|---|---|
| 1 | profondeur | PASS | `/admin/products/new` : 7 étapes à gauche (Identité → Récapitulatif), aperçu de la landing à droite, import JSON et champs Identité visibles | — |
| 2 | profondeur | PASS | « BioInsta » → slug proposé `bioinsta` (auto-dérivé), modifiable en `bio-instagram` ; statut initial Test ; langue changée en English sans blocage | — |
| 3 | profondeur | PASS | `lettre-pro` → « Ce slug est déjà utilisé », reste à l'étape 1 ; `admin` → « Ce slug est réservé », reste à l'étape 1 ; slug libre (`bio-instagram`) → « Suivant » avance à l'étape 2 | — |
| 4 | profondeur | PASS | 4 vignettes (Corporate, Editorial, Neon, Playful) rendues avec leurs tokens ; sélection de Neon → aperçu à jour immédiatement (bouton CTA passe au rose) ; couleur/logo non testés en détail (upload Blob hors mock local, non bloquant) | — |
| 5 | profondeur | PASS | Titre, sous-titre, FAQ (3 questions), meta title/description remplis à la main puis via import ; via import : FAQ et étapes « comment ça marche » visibles dans l'aperçu dès l'import | — |
| 6 | profondeur | PASS (voir aussi B-P4-1) | Manuel : 3 champs créés (`niche` text, `highlights` textarea, `tone` select playful/professional) ; import : mêmes 3 champs pré-remplis ; clé dupliquée (2ᵉ champ → `niche`) → « Clé déjà utilisée », bloqué à l'étape 4, **aucune erreur console « two children with the same key »** (recheck B-N2, voir plus bas) ; corriger la clé débloque | B-P4-1 (mineur, marqueur périmé) |
| 7 | profondeur | PASS (voir aussi B-P4-1) | Cliquer `{{niche}}` insère la variable dans le template ; avec les 3 vraies variables du brouillon (`{{niche}}`, `{{highlights}}`, `{{tone}}`), « Suivant » passe à l'étape 6 sans erreur, en manuel **et** avec la config importée intacte (recheck B-N1, voir plus bas) ; ajouter `{{inconnu}}` → « Variable {{inconnu}} sans champ correspondant », bloqué à l'étape 5 ; le retirer débloque | B-P4-1 |
| 8 | profondeur | PASS | « Tester le prompt » → `POST /admin/products/new` 200, résultat affiché sous le formulaire d'échantillon (Q3 déjà écarté : rejoue la fixture par défaut, non recompté) ; sans remplir l'échantillon → « Complétez les champs obligatoires de l'échantillon », pas d'appel réseau | — |
| 9 | profondeur | PASS | 3 crédits offerts, 1 génération anonyme, coût 1 (valeurs de la config importée) ; packs 10/4,90 € et 50/14,90 € (recommandé) ; marge par génération affichée (« $0.486500 » et « $0.294500 » par génération) | — |
| 10 | profondeur | PASS | Retour à l'étape 1 (via StepNav) : Nom/Slug conservés ; retour à l'étape 6 : crédits, générations gratuites, coût et les 2 packs conservés — `<Activity>` garde l'état des étapes masquées | — |
| 11 | profondeur | PASS | « Enregistrer » → toast « Brouillon enregistré · version 1 », redirection `/admin/products/bio-instagram/edit` ; `/bio-instagram` déjà 200 avant Publier (Q1 déjà écarté, non recompté) | — |
| 12 | profondeur | PASS | Récapitulatif : Nom, Slug, Thème, nombre de champs, nombre de packs corrects ; « Publier » → toast « Produit publié · version N », lien fonctionnel vers `/bio-instagram` | — |
| 13 | profondeur | PASS | `/bio-instagram` (390×844) : thème Neon (CTA rose), landing en anglais (« Try it free », FAQ « Frequently asked questions », « How it works »), `<title>AI Instagram Bio Generator</title>` présent dans le HTML initial (`curl`) | — |
| 14 | profondeur | PASS | `POST /bio-instagram/api/generate` → 200, résultat markdown streamé affiché, puis modale d'inscription (SA-03) ouverte automatiquement après la génération gratuite | — |
| 15 | profondeur | PASS | `/admin/products/bio-instagram/edit` → « Modifier » le headline → « Publier » → `/bio-instagram` montre le nouveau titre à la requête suivante (`curl`, pas de cache périmé, `updateTag` confirmé) ; headline restauré à sa valeur d'origine et republié en fin d'étape | — |
| 16 | — | NON TESTÉ (nettoyage, pas un verdict de scénario) | BioInsta remis à l'état du seed par `reset-demo.ts` en toute fin de passe (le scénario dit de le garder en base pour d'autres scénarios, mais la consigne de la passe impose un reset avant/après ; les deux sont compatibles car le reset recrée BioInsta plus tard si un autre scénario le crée) | — |
| Portefeuille (BO-02, pendant l'étape 15/16) | régression légère | PASS | `/admin` : BioInsta présent, statut Test, sans badge (moins de 1 000 visites, conforme BO-02 § 3) | — |

## Recheck (rapport `2026-09-25-full-3.md`)

| # | Titre | Verdict | Détail |
|---|---|---|---|
| B-N1 | BO-05b étape 5 → 6 : « Suivant » bloqué par une fausse erreur de variable | **CORRIGÉ** | Reproduit deux fois : (1) en saisie manuelle, 3 champs configurés (`niche`, `highlights`, `tone`) puis template avec les 3 vraies variables → « Suivant » avance de l'étape 5 à l'étape 6 sans erreur ; (2) avec `fixtures/bio-instagram.config.json` importé intact, navigation **exclusivement par « Suivant »** de l'étape 1 à l'étape 7 (jamais StepNav ni Enregistrer) → l'étape 5 passe sans erreur (capture `import-step5to6.png`, StepNav entièrement noir, aucun libellé en rouge). Ajouter `{{inconnu}}` bloque toujours l'étape 5 avec « Variable {{inconnu}} sans champ correspondant » ; le retirer débloque. Lu dans le code : `product-form.tsx` › `stepPatch(5, draft)` renvoie désormais `{ generation, inputs: toConfig(draft).inputs }`, donc `validateStep` compare le template aux vrais champs du brouillon. |
| B-N2 | BO-05a étape 4 : clé dupliquée → erreur console React | **CORRIGÉ** | Dupliqué la clé du 2ᵉ champ (`highlights` → `niche`) deux fois (saisie manuelle, session neuve) : message fonctionnel « Clé déjà utilisée » toujours affiché et bloque l'étape (comportement inchangé, correct), et **aucune** occurrence de « two children with the same key » dans `agent-browser console` ni dans `get_errors` du MCP next-devtools après l'opération. Lu dans le code : `generation-step.tsx:95` et `prompt-tester.tsx:51` utilisent désormais `key={input.id}` (l'id client stable généré par `crypto.randomUUID()`), plus `key={input.key}`. |

## Constats

### B-P4-1 · Étapes 4/5 (BO-05) : message d'erreur et marqueur StepNav périmés après une revisite d'étape valide — BUG mineur

- **Étape** : 6, 7 (nouveau constat, découvert pendant le recheck de B-N1 et B-N2)
- **Référence** : `specs/BO-05a-formulaire.md` › Acceptation (« Erreurs affichées à l'étape concernée ») · `specs/BO-05b-generation-publication.md` › Acceptation 1 (« une variable sans champ correspondant bloque l'étape ») — implicitement, une erreur résolue ne devrait plus s'afficher
- **Repro** :
  1. `/admin/products/new`, admin connecté.
  2. Étape 5 « Génération » : ajouter une variable sans champ correspondant (ex. `{{inconnu}}`) dans le template → l'étape se bloque avec « Variable {{inconnu}} sans champ correspondant » (comportement attendu, PASS).
  3. Retirer `{{inconnu}}` du template, cliquer « Suivant » → avance normalement à l'étape 6 (le fix B-N1 fonctionne).
  4. Revenir à l'étape 5 via l'onglet **StepNav** (« 5. Génération » dans le menu latéral, pas via « Précédent » ni « Suivant »).
- **Attendu** : le template affiché est valide (sans `{{inconnu}}`), donc aucune erreur ne devrait s'afficher sous le champ, et les onglets « 4. Champs de l'outil » et « 5. Génération » ne devraient pas apparaître en rouge dans le StepNav.
- **Observé** : le message « Variable {{inconnu}} sans champ correspondant » reste affiché sous le template (alors que son contenu textuel affiché ne contient plus `{{inconnu}}`), et les onglets « 4. Champs de l'outil » et « 5. Génération » restent marqués en rouge dans le StepNav — y compris **après** avoir de nouveau cliqué « Suivant » avec succès jusqu'à l'étape 6 ou 7 (capture `step5-revisit.png`, `step6-pricing.png`, `step7-recap.png`). Même symptôme reproduit indépendamment avec le constat B-N2 (dupliquer puis corriger la clé du champ 4 : l'onglet « 4. Champs de l'outil » reste rouge pour le reste de la session, même après publication réussie). Le marqueur périmé disparaît uniquement après un rechargement complet de la page (ex. redirection vers `/admin/products/bio-instagram/edit` après « Enregistrer »).
- **Cause (lue dans le code, non corrigée)** : `app/(backoffice)/admin/products/_components/product-form/product-form.tsx`, fonction `handleNext()` — quand `validateStep(currentStep, stepPatch(currentStep, draft))` renvoie `{}` (aucune erreur), la fonction avance directement à l'étape suivante (`setCurrentStep(...)`) sans jamais retirer de `errors` les clés qui appartenaient à l'étape courante. Seul le cas particulier du slug (étape 1) a un `clearError("slug")` explicite ; aucun `clearError` équivalent n'existe pour les autres étapes. `StepNav` (`step-nav.tsx`) dérive son état rouge de `stepHasError`, lui-même calculé depuis `Object.keys(errors)` (`product-form.tsx`, juste après `handleNext`) : toute clé d'erreur une fois posée reste dans `errors` pour le reste de la session du formulaire, qu'elle soit ou non encore vraie.
- **Preuve** : captures `step5-revisit.png` (template sans `{{inconnu}}`, message toujours affiché), `step6-pricing.png` et `step7-recap.png` (onglets 4 et 5 toujours rouges après avoir avancé jusqu'à l'étape 6 puis 7) ; `agent-browser console` et `get_errors` du MCP vides à chaque étape (aucune erreur JS, uniquement un défaut d'affichage) ; relecture de `product-form.tsx:263-292` (`handleNext`, `stepHasError`) et `step-nav.tsx:16-45`.
- **Fichiers de la route** : `app/(backoffice)/admin/products/_components/product-form/product-form.tsx` (`handleNext`, `stepHasError`), `app/(backoffice)/admin/products/_components/product-form/step-nav.tsx`
- **Serveur ou UI** : UI (état client uniquement ; aucune requête serveur, aucune erreur console)
- **Sévérité** : mineur — n'empêche ni de naviguer (« Suivant » avance normalement malgré le marqueur), ni d'enregistrer, ni de publier (vérifié : la publication de BioInsta a abouti à l'étape 11/12 malgré ces marqueurs périmés) ; c'est un défaut d'affichage qui peut faire croire à l'admin qu'une étape reste en erreur alors qu'elle est valide — gênant pendant le script de démo si l'admin revisite une étape déjà corrigée avant de publier.

## Nettoyage

BioInsta (créé deux fois pendant la passe : d'abord en saisie manuelle enregistrée en brouillon puis publiée, ensuite recréé via import après un reset intermédiaire et republié avec un headline modifié puis restauré) supprimé par `pnpm tsx scripts/reset-demo.ts` exécuté en toute fin de passe ; portefeuille revenu à l'état du seed (LettrePro, DescriPro, NomDeMarque). Serveur arrêté par son groupe (`kill -TERM -- -<pgid>`), port 3000 libéré (vérifié par `fuser`).

## Outils réellement utilisés

- MCP `next-devtools` : `nextjs_index`, `get_errors` (après chaque parcours, en particulier après le recheck de B-N1, B-N2 et la découverte de B-P4-1)
- `agent-browser` 0.38.1 : sessions `qa-cp1` (admin, desktop 1280×900, formulaire et édition) et `qa-cp2` (visiteur anonyme, mobile 390×844, landing et outil) ; `snapshot`, `fill`, `select`, `click`, `press`, `console`, `errors`, `network requests`, `screenshot`
- `curl` : statuts HTTP et contenu HTML (`<title>`, headline) de `/bio-instagram` avant/après publication et édition
- Lecture de code : `product-form.tsx`, `step-nav.tsx`, `validation.ts`, `generation-step.tsx`, `prompt-tester.tsx` pour confirmer les deux corrections (B-N1, B-N2) et documenter la cause de B-P4-1
- `pnpm tsx scripts/reset-demo.ts`, `pnpm db:migrate`
