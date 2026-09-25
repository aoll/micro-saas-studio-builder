---
name: qa-orchestrator
description: >
  Pilote un run QA jusqu'à zéro constat : lance une passe de la skill qa (par
  défaut scenario=full, mode delta contre .claude/qa/route-baseline.json),
  présente à l'humain les BUG et les MANQUE, et après sa validation seulement
  transforme chaque constat retenu en spec de correction, puis les fait
  implémenter dans des worktrees partant d'une branche d'intégration du run,
  avec exactement le flux de la skill orchestrator (registre, dispatch
  continu, plan, TDD, revue, /verify, PR, merge). Quand la liste est vide,
  nouvelle passe QA sur la branche d'intégration, et ainsi de suite jusqu'à
  une passe sans constat à corriger ; alors il réécrit la baseline et rend la
  main. Utiliser pour « passe QA et corrige », ou après un run
  d'implémentation avant de merger sur main.
---

# Orchestrateur QA

Tu es l'orchestrateur du run QA : la session principale. Tu ne testes rien
toi-même (c'est la skill `qa`, dans un agent) et tu n'implémentes rien
toi-même (ce sont les agents du flux de la skill `orchestrator`), sauf pour
reprendre une spec bloquée, comme l'orchestrateur d'implémentation. Tu
lances, tu consolides, tu présentes, tu fais valider, tu dispatches, tu
merges dans la branche d'intégration du run, et tu tiens le registre.

Le run alterne deux phases, jamais en même temps :

```
passe QA n ──► constats ──► validation humaine ──► corrections (worktrees, flux orchestrator)
    ▲                                                       │
    └──────────────── liste vide : passe QA n+1 ◄───────────┘
fin : une passe dont aucun constat n'est retenu ─► baseline réécrite ─► main rendue à l'humain
```

Une passe teste une tête figée de la branche d'intégration : aucun worktree de
correction ne tourne et rien ne se merge pendant une passe ; aucune passe ne
démarre tant qu'une spec de correction n'est pas mergée.

## 0. Paramètres

- **`scenario`** : transmis à la skill `qa` ; `full` par défaut.
- **`mode`** : transmis à la skill `qa` ; `delta` par défaut (la passe 1 d'un
  dépôt sans baseline est complète d'elle-même).
- **`base`** : la branche testée, d'où part la branche d'intégration du run et
  où l'humain la mergera. Par défaut, la branche d'intégration courante
  (`git config msb.integration`) si elle existe sur origin et n'est pas encore
  mergée dans `main` (`git merge-base --is-ancestor origin/<elle> origin/main`
  échoue), sinon `main`. Dis quelle base tu retiens avant de lancer.
- **`run`** : `qa<N>`, N = le premier numéro libre dans `.claude/runs/qa*.json`
  de la base.

## 1. Mise en place du run

1. **Branche d'intégration** `integration/<run>`, créée depuis `base` puis
   enregistrée (le script ne sait créer que depuis `main` ; il reconnaît une
   branche déjà sur origin) :

   ```bash
   git fetch origin
   git push origin origin/<base>:refs/heads/integration/<run>
   pnpm tsx scripts/worktree.ts integration integration/<run>
   git switch integration/<run>    # le checkout principal y reste tout le run
   ```

   Tous les worktrees de correction partent d'elle, toutes les PR la ciblent,
   rapports, specs de correction et registre y sont commités. Tu ne merges
   jamais dans `main` ni dans `base` : c'est l'humain qui merge
   `integration/<run>` dans `base` à la fin.
2. **Registre** `.claude/runs/<run>.json`, même schéma que celui de la skill
   `orchestrator`, plus les passes et les constats écartés :

   ```json
   {
     "integration": "integration/qa1",
     "base": "integration/v1",
     "scenario": "full",
     "passes": [
       { "n": 1, "report": ".claude/qa/reports/2026-09-26-full.md", "findings": 7, "retained": 5 }
     ],
     "setAside": [
       { "finding": "B3", "report": ".claude/qa/reports/2026-09-26-full.md", "reason": "…décision de l'humain…" }
     ],
     "specs": {
       "QA1-P1-B1-tester-prompt": { "dependsOn": [], "status": "ready", "worktree": null, "pr": null }
     },
     "pendingIntegrations": []
   }
   ```

   Commit et push sur la branche d'intégration (`chore(qa): start <run>`).
3. **Surveillance** : les trois couches de la skill `orchestrator` › Monitoring
   (daemon, Monitor sur `monitor.log`, `send_later` toutes les 5 min), telles
   quelles. Le message du heartbeat dit en plus la phase en cours (passe n, ou
   corrections de la passe n) et, en phase de passe, vérifie que l'agent QA
   tourne encore.

## 2. Phase de passe

Un seul agent, en arrière-plan (`general-purpose`), dans le **checkout
principal** (sur `integration/<run>`, port 3000, base de `.env.local` remise à l'état du seed par la
skill) :

> Invoque la skill `qa` avec scenario=`<scenario>`, mode=`<mode>`,
> commit=`non`, recheck=`<rapport de la passe précédente, ou aucun>`. Les
> constats déjà écartés par l'humain, à ne pas recompter comme nouveaux s'ils
> sont inchangés : `<setAside du registre, ou aucun>` ; s'ils réapparaissent,
> range-les en « Recheck » avec le verdict TOUJOURS PRÉSENT (écarté). Rends le
> chemin du rapport, le décompte, et la liste des constats (identifiant,
> catégorie, sévérité, titre, référence, fichiers de la route).

**Passe ciblée.** Tant qu'aucune baseline n'existe (le mode delta vaut alors
une passe complète), une passe de recheck après quelques corrections locales
peut être ciblée : le scénario ou les étapes des specs que ces corrections
touchent, en mode `complet`, avec `recheck`. Note la portée dans `passes`
(`scope`). La passe qui clôt le run est toujours `full`, en mode `complet`
sans baseline.

Attends sa notification (le heartbeat couvre l'attente). Un agent qui échoue
ou rend un rapport incomplet (étapes manquantes, `NON TESTÉ` sans raison) est
relancé une fois sur le même brief, puis signalé à l'humain.

Quand le rapport est là, relis-le en entier : chaque constat doit avoir sa
référence au dossier ou à une spec et sa repro ; un constat sans référence
devient « À qualifier ». Commite-le seul sur la branche d'intégration
(`docs(qa): add the <scénario> QA report of <date>, <run> pass <n>`) et pousse.

## 3. Présenter et faire valider

Montre à l'humain, en français :

| Constat | Catégorie | Sévérité | Titre | Référence | Proposition |
|---|---|---|---|---|---|
| B1 | BUG | bloquant | « Tester le prompt » renvoie 500 | BO-05b › Acceptation 2 | corriger |
| M1 | MANQUE | — (Indispensable) | pas de pagination des achats | BO-04 › Acceptation 1 | corriger |
| B4 | BUG | mineur | libellé tronqué en 390 px | docs/02 › SA-02 | corriger, groupé avec B2 (même composant) |
| Q1 | À qualifier | — | … | … | lecture A ou lecture B ? |

Puis, en une ligne chacun : le recheck de la passe précédente (CORRIGÉ,
TOUJOURS PRÉSENT), les constats déjà écartés qui réapparaissent, et ce qui ne
peut pas se corriger sans l'humain (un contrat gelé à changer : une spec
CONTRACT, comme dans le run d'implémentation).

**Ne dispatche rien sans validation explicite**, même si tout paraît évident :
une passe peut n'être voulue que pour information. L'humain répond par
constat (corriger, écarter avec une raison, requalifier un « À qualifier »),
ou en bloc (« tout », « tout sauf B4 »). Ensuite :

- **délégation** : si l'humain autorise une catégorie de corrections sans
  validation (ex. « n'attends pas ma confirmation pour cette catégorie »),
  note-la dans la Décision avec sa portée exacte (typiquement : affichage,
  traduction, garde locale, sans contrat gelé ni règle métier) ; les constats
  suivants de cette catégorie partent sans attendre, présentés après coup. Tout
  autre constat reste soumis à validation ;
- ajoute au rapport la section « Décision » (format :
  `.claude/qa/reports/README.md`) ;
- ajoute les constats écartés à `setAside`, avec la raison ;
- mets à jour `passes` (`findings`, `retained`).

Si aucun constat n'est retenu, le run se termine (section 6).

## 4. Constats retenus → specs de correction

Chaque constat retenu devient une spec, dans `specs/qa/<REF>-<slug>.md`,
REF = `QA<N>-P<n>-<constat>` (`QA1-P1-B1`), slug en `[a-z0-9-]` : c'est aussi
le nom du worktree (`qa1-p1-b1-tester-prompt`). Même gabarit que
`specs/README.md` :

```md
# QA1-P1-B1 · « Tester le prompt » renvoie 500
Réf         : .claude/qa/reports/2026-09-26-full.md › B1 (validé par l'humain le 2026-09-26)
              · specs/BO-05b-generation-publication.md › Acceptation 2 · docs/02 › BO-05
Contrat     : <celui de la spec d'origine ; aucun contrat gelé ne change hors spec CONTRACT>
Dépend de   : <autres specs de correction qui touchent les mêmes fichiers, sinon —>
Acceptation :
- <BUG : la repro du rapport, devenue comportement attendu, vérifiable par un test>
- <MANQUE : les puces d'acceptation manquantes de la spec d'origine, recopiées>
Périmètre   : <les fichiers en cause, lus dans le code, dans le Périmètre de la spec d'origine>
Hors périmètre : les autres constats du rapport
```

- **BUG** : la première puce est la repro du rapport ; le premier test de
  `tdd-guide` la reproduit et échoue avant la correction (cause racine d'abord,
  jamais un contournement du symptôme). Test Vitest au niveau le plus bas qui
  montre le bug ; un bug visible seulement dans un navigateur prend un test
  Playwright dans `e2e/` (`pnpm test:e2e <fichier>`).
- **Chaîne entière** : l'acceptation d'un message, d'une erreur ou d'un
  chiffre se vérifie là où l'utilisateur la voit, champ par champ, pas
  seulement dans la fonction qui la produit (en qa1, une traduction corrigée
  restait invisible sur quatre champs qui n'affichaient pas leur erreur).
- **MANQUE** : l'acceptation vient de la spec d'origine ou du dossier, jamais
  du comportement observé.
- **Regrouper** : deux constats de même cause racine ou du même composant font
  une seule spec (REF du premier, les deux constats dans `Réf`). Deux specs
  dont les `Périmètre` se recouvrent sans même cause : la seconde dépend de la
  première (`Dépend de`), pour qu'elles ne se croisent jamais dans le même
  fichier.
- **Lot léger** : les constats légers (libellé, traduction, affichage d'une
  erreur, garde locale, même composant ou même zone) peuvent former une seule
  spec dont le champ `Plan` tient en quelques lignes : pas de `planner`, un
  seul `tdd-guide` qui écrit quand même le test de repro d'abord. Un constat
  qui demande de choisir une solution (cause racine incertaine, plusieurs
  lectures du dossier, sécurité, crédits) garde le flux complet.
- **Contrat gelé** (`lib/db/schema.ts`, `lib/schemas/**`, signature DAL) : la
  correction est une spec CONTRACT, présentée comme telle à l'humain à
  l'étape 3 ; sans son accord explicite sur ce point, le constat ne part pas.

La validation de l'humain à l'étape 3 vaut approbation de ces specs (la porte 1
du run d'implémentation) : ne lui redemande pas. Commite les specs et le
registre (chaque spec en `ready` ou `pending` selon `Dépend de`) sur la branche
d'intégration : `chore(qa): <run> pass <n> fix specs`.

## 5. Phase de corrections : le flux de la skill `orchestrator`, tel quel

Lis `.claude/skills/orchestrator/SKILL.md` et applique ses sections
« Dependency registry » (boucle de dispatch continu, dépendances, `Dependency
gaps`), « Per-spec flow » (worktree, `planner`, `tdd-guide`, `/review`,
`/verify`, PR, merge), « Merge gate », « Machine limits », « A stuck spec » et
« Status », sans rien changer, sur le registre du run QA. Seules différences :

- **Chemin des specs** : `specs/qa/<REF>-<slug>.md`.
- **Brief** : en plus de docs/, CLAUDE.md et la spec, l'agent lit le rapport
  QA et le constat cité en `Réf`, et la spec d'origine.
- **Titre de PR** : `fix(<scope>): <REF> <résumé>` pour un BUG,
  `feat(<scope>): <REF> <résumé>` pour un MANQUE ; même corps, même squash
  merge dans `integration/<run>`.
- **Agents** : lancés avec `model: "sonnet"` (passes QA, `planner`,
  `tdd-guide`, relecteurs). Chaque brief rappelle les commandes en file :
  `pnpm typecheck`, `pnpm test`, `pnpm check`, `pnpm test:e2e <fichier>`,
  jamais `npx tsc`, `pnpm vitest run` sans fichier ni enveloppe `queued.sh`.
- **E2E** : contrairement au run d'implémentation, une spec de correction
  peut lancer et étendre les e2e de sa zone (`pnpm test:e2e <fichier>`) : un
  constat QA est souvent visible seulement dans un navigateur. Les échecs e2e
  sans rapport avec la spec restent pour la phase E2E.
- **Revue** : pour un diff de lot léger très court (une fonction pure, un
  affichage calqué sur un existant), tu peux faire la revue toi-même ; lis
  alors l'acceptation champ par champ contre le diff (voir « Chaîne entière »).
- **Un constat toujours présent** au recheck alors que sa spec est mergée est
  une spec bloquée : tu la reprends (section « A stuck spec »), sans redemander
  à l'humain, qui l'a déjà validée.
- **Ne va à l'humain** que ce que la skill `orchestrator` lui envoie : un
  contrat gelé hors spec CONTRACT, une spec de correction infaisable telle
  qu'écrite.

La phase se termine quand chaque spec de la passe est `merged` et qu'aucune
entrée de `pendingIntegrations` n'est ouverte. Alors, dans l'ordre : `git pull`
dans le checkout principal, plus aucun worktree de correction
(`pnpm tsx scripts/worktree.ts list`), puis retour à la section 2 pour la passe
n+1, avec `recheck` = le rapport de la passe n.

## 6. Fin du run

Le run se termine quand une passe n'a aucun constat retenu : aucun constat,
ou tous écartés par l'humain. Alors, sur la branche d'intégration :

1. `/verify` sur `integration/<run>` : READY, sinon traite-le comme une spec
   bloquée.
2. Baseline : `pnpm tsx scripts/qa-baseline.ts write --note "<run>, <date>,
   scenario=<scenario>, <n> passes, <constats corrigés> corrigés, <écartés>
   écartés"`, commitée seule et poussée (`chore(qa): QA baseline after <run>`).
   Jamais avant : une baseline marque un état dont tous les constats sont
   traités. Un run arrêté par l'humain avant la fin ne la réécrit pas.
3. Surveillance arrêtée (skill `orchestrator` › End of the run).
4. Rends la main, en français : la branche `integration/<run>` à merger dans
   `<base>`, le registre, les rapports de chaque passe, les specs de
   correction mergées (avec leur PR), les constats écartés et leur raison,
   ceux que tu as repris toi-même et pourquoi.

Après un container reset, reconstruis tout depuis git, jamais de mémoire : le
registre du run, les rapports et leurs sections « Décision »,
`worktree.ts list`, les PR ouvertes ; puis relance la surveillance et reprends
la phase où elle en était (une passe interrompue se relance entière).
