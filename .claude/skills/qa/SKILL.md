---
name: qa
description: >
  Passe QA locale de la plateforme : lance le serveur de dev (Postgres, base
  migrée et seedée, AI_MODE=mock), pilote un vrai navigateur (skill
  next-dev-loop + agent-browser, repli Playwright) et le MCP next-devtools, et
  confronte l'app au dossier docs/ et aux specs/. Rejoue un scénario de
  scenarios/ (full par défaut : toute la plateforme) et consigne chaque écart
  en BUG ou MANQUE dans .claude/qa/reports/<date>-<scénario>.md. En mode
  delta (défaut), approfondit ce qui a changé depuis la baseline
  .claude/qa/route-baseline.json et ne fait qu'une régression légère ailleurs.
  Constat seulement, aucune correction (c'est la skill qa-orchestrator qui
  fait corriger). Utiliser pour une passe QA complète, ou pour
  la QA d'une feature après une implémentation ou un run d'orchestration.
---

# QA de la plateforme

Tu joues les utilisateurs de la plateforme (visiteur, inscrit, admin, owner)
sur le serveur de dev local, et tu compares ce que tu vois à ce que décrivent
le dossier et les specs. Tu ne corriges rien : tu constates, tu prouves, tu
consignes. Les faits stables (ports, comptes, commandes, snippet Playwright,
garde-fous) sont dans `config.md`, à côté de ce fichier : lis-le avant de
commencer, ne le recopie pas de mémoire.

## 0. Paramètres

- **`scenario`** : un nom de fichier de `scenarios/` (`creation-produit`,
  `sous-app-funnel.md`…), ou `full` (défaut) = `scenarios/full.md`, toute la
  plateforme. Un nom inconnu : liste `scenarios/` et demande, ne devine pas.
- **`focus`** (optionnel) : routes ou specs (`SA-05`, `/admin/settings`) qui
  limitent la passe. Les étapes du scénario hors focus sont `NON TESTÉ (hors
  focus)` dans le rapport, jamais omises en silence.
- **`mode`** : `delta` (défaut) ou `complet`. En `delta`, la profondeur de
  chaque étape vient du diff contre la baseline (section 2 bis) ; sans
  baseline (première passe), `delta` vaut `complet`. `complet` teste tout en
  profondeur.
- **`recheck`** (optionnel) : le chemin d'un rapport précédent. Chaque constat
  de ce rapport est rejoué d'après sa repro, et reçoit un verdict dans la
  section « Recheck » du nouveau rapport, quel que soit le mode.
- **`commit`** : `oui` (défaut) ou `non`. `non` quand la skill
  `qa-orchestrator` t'appelle : c'est elle qui commite le rapport.

## 1. Lire le contexte d'abord, et en entier

La QA juge l'app contre le dossier, pas contre ta mémoire ni contre le code.

1. **Chaque fichier de `docs/`**, en entier, dans l'ordre de `docs/README.md`
   (00 à 13), pas seulement les sections citées.
2. **Chaque fichier de `specs/`** (index : `specs/README.md`), en entier,
   notes de run comprises (« Note (run v1…) » : une exigence retirée par
   décision humaine n'est ni un BUG ni un MANQUE).
3. **Les maquettes** que le scénario cite (`specs/mockups/*.png`) : ouvre-les
   avec l'outil de lecture d'image.
4. `CLAUDE.md`, `AGENTS.md`, puis `config.md` et le scénario choisi.

## 2. Démarrer l'environnement

Toutes les commandes : `config.md` › Environnement. En résumé :

1. **Postgres** : le hook SessionStart le lance ; sinon
   `node .claude/hooks/session-start.mjs`.
2. **Base** : dans un worktree, `pnpm tsx scripts/worktree-db.ts ensure --seed`
   (base propre au worktree, migrée et seedée) ; dans le checkout principal,
   `pnpm db:migrate && pnpm db:seed`. Le seed est déterministe : LettrePro
   (Scale, « à scaler »), DescriPro (Learn, sans badge), NomDeMarque (Test,
   « à couper »), comptes admin et owner, 30 jours d'usage.
3. **Serveur** : `pnpm dev` pose déjà `AI_MODE=mock`. Port 3000 dans le
   checkout principal seulement (CLAUDE.md) ; depuis un worktree, un port
   libre (3200 par défaut) avec `BETTER_AUTH_URL` aligné dessus, sinon les
   liens magiques visent le mauvais port et Better Auth peut refuser
   l'origine. Lance-le en arrière-plan dans son propre groupe de processus,
   journal dans le scratchpad, puis attends qu'il réponde avec le
   `curl --retry` de `config.md` (sort seul, en 200 ou en échec après ~2 min).
4. **Jamais** de boucle `until`/`while pgrep -f …` : `pgrep -f` voit sa propre
   ligne de commande et la boucle ne sort jamais. Pour savoir si le port est
   pris : `fuser <port>/tcp`.
5. **À la fin** (même si la passe échoue) : arrête le serveur par son groupe
   (`kill -TERM -- -<pgid>`, le groupe noté au lancement) et vérifie que le
   port est libéré.

## 2 bis. Le delta contre la baseline

`.claude/qa/route-baseline.json` garde le hash git de chaque fichier de
l'app (`app/`, `lib/`, `messages/`, `fixtures/`, `proxy.ts`, hors tests) à la
fin du dernier run QA dont tous les constats ont été traités. Seule la skill
`qa-orchestrator` le réécrit ; toi, tu le lis :

```bash
pnpm tsx scripts/qa-baseline.ts diff   # A / M / D par fichier, puis le décompte
```

1. Traduis chaque fichier `A` (ajouté), `M` (modifié) ou `D` (supprimé) en
   specs et en étapes du scénario avec la table `config.md` › Delta : ces
   étapes sont en **profondeur** (tout le parcours, les variantes de la
   section 6.5, les états).
2. Les autres étapes sont en **régression légère** : la route charge (pas de
   4xx/5xx inattendu), l'action principale de l'étape aboutit, et ni la
   console, ni `get_errors`, ni le journal du serveur ne signalent d'erreur.
   Pas de variantes.
3. Un fichier partagé (`lib/**`, `messages/*/common.json`, `[app]/layout.tsx`,
   `proxy.ts`) met en profondeur toutes les étapes que la table lui associe,
   et elle lui en associe beaucoup : c'est voulu.
4. En mode `complet`, ou sans baseline, tout est en profondeur.

La colonne « Profondeur » du rapport dit, pour chaque étape, laquelle a été
appliquée et pourquoi (le fichier `M` qui l'a déclenchée).

## 3. L'outillage Vercel / Next.js

Deux vues du même serveur, qui se contrôlent l'une l'autre (skill
`next-dev-loop`, à lire : `.claude/skills/next-dev-loop/SKILL.md`).

- **MCP `next-devtools`** (`.mcp.json`) : erreurs de compilation et d'exécution
  (serveur et navigateur), logs, routes, Server Actions du serveur de dev. Ses
  outils peuvent être différés : charge-les avec `ToolSearch`
  (`select:mcp__next-devtools__nextjs_index,mcp__next-devtools__nextjs_call`)
  puis `nextjs_index` pour trouver le serveur et `nextjs_call` (`get_errors`,
  `get_logs`, `get_routes`, `get_server_action_by_id`). Repli si le MCP est
  absent : l'endpoint HTTP `/_next/mcp` du serveur, en `curl` (`config.md`).
  **Après chaque parcours** : `get_errors`, et le journal du serveur.
- **`agent-browser`** (vrai Chrome, piloté par la skill `next-dev-loop`) : DOM,
  snapshot d'accessibilité, console, erreurs de page, réseau, arbre React,
  Suspense en attente. Lance d'abord `agent-browser skills get core` pour
  l'usage exact de la version installée. Headless ici (pas de `--headed`),
  Chromium préinstallé (`config.md`). Contrairement à ce que dit
  next-dev-loop, personne ne se connecte à ta place : tu te connectes
  toi-même avec les comptes de la section 4.
- **Installation** si absents : `config.md` › Outillage. Si l'installation est
  impossible (réseau), note-le dans le rapport et passe au repli.
- **Repli Playwright** : `@playwright/test` du repo avec le Chromium
  préinstallé (`executablePath: '/opt/pw-browsers/chromium'`), scripts dans le
  scratchpad, jamais commités ; jamais `playwright install`.
- **Shell instantané** : `instant()` de `@next/playwright` (docs/04) n'est pas
  installé ; ne l'installe pas. Vérifie le shell avec le HTML initial
  (`curl`) et `agent-browser react suspense --only-dynamic`.

## 4. Personas et comptes

Détail et identifiants : `config.md` › Personas.

| Persona | Entrée | Compte |
|---|---|---|
| Visiteur anonyme | `/{slug}` → `/{slug}/tool` : la génération gratuite | aucun ; cookie `anonymous_id` neuf, IP simulée propre au parcours |
| Inscrit | modale `/{slug}/signup`, lien magique via la boîte de réception simulée | jetable, un par parcours |
| Admin de démo | `/admin/login` | seed : `DEV_ADMIN` de `scripts/seed.ts`, ou `SEED_ADMIN_*` |
| Owner | `/admin/login` puis `/admin/ops` | seed : `DEV_OWNER`, ou `SEED_OWNER_*` |

N'écris jamais un vrai secret dans le rapport : cite la constante ou la
variable d'environnement.

## 5. Garde-fous

- **Local uniquement** : `http://localhost:<port>`, jamais une URL déployée
  (preview ou production Vercel).
- **Paiement simulé** : vérifie la mention « paiement simulé » avant de payer ;
  si elle manque, arrête ce parcours et consigne un BUG bloquant.
- **« Réinitialiser la démo » (`/admin/ops`)** efface les produits et l'usage
  des visiteurs de la base de dev : seulement en dernière étape d'un scénario
  qui le demande, puis re-seed.
- **Comptes jetables**, un par parcours ; jamais de création en masse.
- **État restauré** : ce que tu modifies sur un produit, un thème ou les seuils
  seedés, remets-le à sa valeur (notée avant) à la fin de l'étape ; ne passe en
  Killed qu'un produit créé pendant la passe.
- **Aucune correction de code** depuis cette skill, même triviale.
- **Captures et scripts** dans le scratchpad de la session
  (`<scratchpad>/qa/<date>-<scénario>/`), jamais dans le repo.

## 6. Dérouler le scénario

Pour chaque étape du scénario :

1. **Trouve le vrai point d'entrée dans le code** avant d'agir : la page de la
   route (`app/(products)/[app]/…`, `app/(backoffice)/admin/…`), ses
   `_components/`, ses `_actions.ts`, et le libellé exact dans
   `messages/fr|en/*.json` ou le JSX. Ne devine jamais un bouton ni une route :
   un libellé introuvable dans le code est un indice de MANQUE, pas une raison
   d'improviser.
2. **Agis comme la persona** dans le navigateur, puis vérifie le résultat
   attendu et sa référence (spec › Acceptation, docs › section, maquette).
3. **Capture le réseau** de chaque mutation (Server Action, `POST
   /{slug}/api/generate`, `/api/auth/*`) : statut et corps. Une mutation en
   4xx/5xx est un échec serveur ; une mutation en 200 avec une UI figée est un
   problème d'affichage. Le rapport dit lequel.
4. **Après chaque étape** : console et erreurs de page (`agent-browser console`,
   `errors`), `get_errors` du MCP, fin du journal du serveur.
5. **Couvre les variantes que le dossier décrit** quand le scénario touche
   l'écran : fr et en (le produit `locale=en` du scénario), largeur mobile
   (390 × 844) pour la sub-app, clair et sombre, et les états des écrans
   (docs/02 › « États à prévoir » : vide, chargement, erreur, killed…).
6. **Capture d'écran** de chaque écart, nommée `<n°étape>-<slug>.png`.

Une étape impossible (prérequis cassé, outil absent) : `NON TESTÉ` avec la
raison, puis continue avec la suivante.

## 7. Le rapport

Écris `.claude/qa/reports/<YYYY-MM-DD>-<scénario>.md` (suffixe `-2`, `-3` si
le fichier existe) selon le format de `.claude/qa/reports/README.md`. Chaque
constat est l'un de :

- **BUG** : implémenté, mais se comporte mal. Sévérité (bloquant / majeur /
  mineur), étapes de repro exactes, attendu avec sa référence docs/spec,
  observé, réponse réseau ou erreur console, chemin de la capture, fichier de
  la route.
- **MANQUE** : décrit par le dossier ou une spec, mais absent ou incomplet.
  Référence docs/spec, ce qui manque, où tu l'as cherché dans le code (chemins,
  `grep`).

Plus : tableau par étape (PASS / BUG / MANQUE / NON TESTÉ, avec une raison et
la profondeur appliquée), décompte par catégorie et par sévérité, outils
réellement utilisés (MCP, agent-browser ou repli Playwright), environnement
(SHA du commit, branche, base, port, seed, mode et baseline comparée), et,
avec `recheck`, la section « Recheck » : chaque constat du rapport précédent
en **CORRIGÉ**, **TOUJOURS PRÉSENT** (il redevient un constat de ce rapport,
avec son ancien identifiant en référence) ou **NON TESTÉ** (avec la raison).

Avec `commit=oui` : le rapport est commité, pour que l'humain suive les
passes, dans un commit qui ne contient que lui (`docs(qa): add the
<scénario> QA report of <date>`), poussé. Sur `main` ou sur la branche
d'intégration (`git config msb.integration`), ne commite pas dessus : crée
`qa/<date>-<scénario>` depuis elle et pousse-la. Avec `commit=non` : laisse
le fichier non commité.

Termine par le chemin du rapport et le décompte. La correction des constats
appartient à la skill `qa-orchestrator` : ne la lance pas d'ici.
