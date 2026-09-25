# Rapports QA

Un fichier par passe de la skill `qa` (`.claude/skills/qa/`), nommé
`<YYYY-MM-DD>-<scénario>.md` (`2026-09-25-full.md`,
`2026-09-26-creation-produit.md` ; suffixe `-2` pour une seconde passe le même
jour). Les rapports sont commités, seuls dans leur commit
(`docs(qa): add the <scénario> QA report of <date>`), pour que l'humain suive
les passes dans l'historique. Captures et scripts restent dans le scratchpad de
la session : le rapport cite leurs chemins, il ne les embarque pas.

Un rapport est un constat : il ne corrige rien et ne se modifie pas après coup,
sauf pour ajouter le lien d'une correction (PR, spec résiduelle) sous le
constat concerné. Quand la skill `qa-orchestrator` pilote la passe, c'est elle
qui commite le rapport sur la branche d'intégration de son run QA, avec la
décision de l'humain sur chaque constat (section « Décision »).

## Décision (ajoutée par `qa-orchestrator`)

Après la validation de l'humain, l'orchestrateur QA ajoute en fin de rapport :

| Constat | Décision | Spec de correction |
|---|---|---|
| B1 | corriger | `specs/qa/QA1-B1-tester-prompt.md` |
| M1 | corriger | `specs/qa/QA1-M1-pagination-achats.md` |
| B2 | écarté : <raison de l'humain> | — |

## Catégories

| Catégorie | Définition | Sévérités |
|---|---|---|
| **BUG** | Implémenté, mais se comporte mal au regard du dossier ou d'une spec | **bloquant** : casse le script de démo ou perd des crédits / de l'argent / des données ; **majeur** : une acceptation de spec échoue, contournable ; **mineur** : cosmétique, libellé, état secondaire |
| **MANQUE** | Décrit par le dossier ou une spec, mais absent ou incomplet dans le code | — (la priorité vient de la spec : Indispensable ou Bonus) |

Une exigence retirée par une note de run dans la spec (« Note (run v1…) »)
n'est ni un BUG ni un MANQUE. Un écart dont la référence est ambiguë se range
en **À qualifier** (en fin de rapport), avec les deux lectures possibles.

## Format

```md
# QA <scénario> — <YYYY-MM-DD>

## Environnement

| | |
|---|---|
| Commit | <SHA de 40 caractères> (`<branche>`) |
| Base | `msb_<…>`, seed `scripts/seed.ts` (re-seed : oui / non) |
| Serveur | `pnpm dev -p <port>`, AI_MODE=mock, DEMO_MODE=<…>, autres variables posées |
| Outils | MCP next-devtools : oui / non (repli `/_next/mcp`) · agent-browser <version> / repli Playwright · next-dev-loop : oui / non |
| Personas | anonyme (IP simulées …), inscrits jetables (emails), admin, owner |
| Focus | <routes ou specs, ou « aucun »> |
| Mode | delta contre `<commitSha>` de la baseline (<A> ajoutés, <M> modifiés, <D> supprimés) · complet · delta sans baseline (= complet) |
| Recheck | `<chemin du rapport précédent>`, ou « aucun » |
| Artefacts | `<scratchpad>/qa/<date>-<scénario>/` |

## Synthèse

| BUG bloquant | BUG majeur | BUG mineur | MANQUE | À qualifier | PASS | NON TESTÉ |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Étapes

| Étape | Profondeur | Verdict | Raison | Constat |
|---|---|---|---|---|
| 1.1 | légère | PASS | redirection vers /admin/login | — |
| 3.7 | profondeur (M `admin/products/_actions.ts`) | BUG | « Tester le prompt » renvoie 500 | B1 |
| 6.4 | profondeur (A `activity/_components/purchases.tsx`) | MANQUE | pas de pagination des achats | M1 |
| 10.3 | légère | NON TESTÉ | pas assez de crédits pour dépasser N | — |

## Recheck

Seulement avec `recheck` : un verdict par constat du rapport précédent.

| Constat précédent | Verdict | Preuve ou raison | Nouveau constat |
|---|---|---|---|
| B1 (2026-09-25-full) | CORRIGÉ | `POST /admin/products/new` → 200, aperçu affiché | — |
| M1 (2026-09-25-full) | TOUJOURS PRÉSENT | toujours 50 achats sans pagination | M1 |

## Constats

### B1 · <titre court> — BUG <bloquant | majeur | mineur>

- **Étape** : 3.7
- **Référence** : `specs/BO-05b-generation-publication.md` › Acceptation 2 · docs/02 › BO-05
- **Repro** :
  1. …
  2. …
- **Attendu** : …
- **Observé** : …
- **Preuve** : réseau `POST /admin/products/new` → 500 `{…}` ; console `…` ; MCP `get_errors` `…`
- **Capture** : `<scratchpad>/qa/<date>-<scénario>/3.7-tester-prompt.png`
- **Fichier de la route** : `app/(backoffice)/admin/products/_actions.ts` (`testPrompt`)
- **Serveur ou UI** : échec serveur (mutation en 500) | affichage (mutation en 200, UI figée)

### M1 · <titre court> — MANQUE

- **Étape** : 6.4
- **Référence** : `specs/BO-04-activite.md` › Acceptation 1
- **Ce qui manque** : …
- **Cherché dans** : `app/(backoffice)/admin/products/[slug]/activity/**`, `grep -rn "…" app lib`

## À qualifier

- …
```
