---
name: qa
description: >
  Passe QA de la plateforme, sur trois environnements possibles (`env`) :
  `local` (défaut, serveur de dev, Postgres migré et seedé, AI_MODE=mock) ou
  `preview`/`prod` (une URL Vercel déjà vivante, AI_MODE=live). Toute
  opération — génération IA, inscription, paiement simulé, connexion et
  écriture admin, « Réinitialiser la démo » — est permise sur les trois
  environnements (décision humaine du 2026-09-27 : c'est une démo, les mêmes
  personas et le même scénario y jouent partout), avec les garde-fous de bon
  sens de la section 5 (compte jetable, état restauré, mention « paiement
  simulé »). Pilote un vrai navigateur (skill next-dev-loop + agent-browser en
  local, repli Playwright partout, obligatoire sur une URL déployée) et le MCP
  next-devtools en local, et confronte l'app au dossier docs/ et aux specs/.
  Rejoue un scénario de scenarios/ (full par défaut : toute la plateforme) et
  consigne chaque écart en BUG ou MANQUE dans
  .claude/qa/reports/<date>-<scénario>.md. En local et en mode delta (défaut),
  approfondit ce qui a changé depuis la baseline .claude/qa/route-baseline.json
  et ne fait qu'une régression légère ailleurs. Constat seulement, aucune
  correction (c'est la skill qa-orchestrator qui fait corriger). Utiliser pour
  une passe QA complète, pour la QA d'une feature après une implémentation ou
  un run d'orchestration, ou pour tester un déploiement (preview ou prod) de
  bout en bout, y compris ses mutations.
---

# QA de la plateforme

Tu joues les utilisateurs de la plateforme (visiteur, inscrit, admin, owner)
sur la cible désignée par `env`, et tu compares ce que tu vois à ce que
décrivent le dossier et les specs. Tu ne corriges rien : tu constates, tu
prouves, tu consignes. Les faits stables (ports, comptes, commandes, snippet
Playwright, garde-fous, recette preview/prod) sont dans `config.md`, à côté
de ce fichier : lis-le avant de commencer, ne le recopie pas de mémoire.

## 0. Paramètres

- **`env`** : `local` (défaut), `preview` ou `prod`. Les trois autorisent
  toute opération (génération IA, inscription, paiement, écritures admin,
  reset démo) : décision humaine du 2026-09-27, plus de distinction lecture
  seule pour `preview`/`prod` (§5). Change la section 2 (comment atteindre la
  cible) et la 2 bis (mode delta : local seulement, faute de baseline de code
  pertinente pour une URL déployée).
- **`url`** (obligatoire si `env=preview`, optionnel si `env=prod` pour
  surcharger l'URL par défaut de `config.md` › Cible ; ignoré en `local`).
- **`scenario`** : un nom de fichier de `scenarios/` (`creation-produit`,
  `sous-app-funnel.md`…), ou `full` (défaut) = `scenarios/full.md`, toute la
  plateforme. Un nom inconnu : liste `scenarios/` et demande, ne devine pas.
- **`focus`** (optionnel) : routes ou specs (`SA-05`, `/admin/settings`) qui
  limitent la passe. Les étapes du scénario hors focus sont `NON TESTÉ (hors
  focus)` dans le rapport, jamais omises en silence.
- **`mode`** : `delta` (défaut) ou `complet`, **`env=local` seulement**. En
  `delta`, la profondeur de chaque étape vient du diff contre la baseline
  (section 2 bis) ; sans baseline (première passe), `delta` vaut `complet`.
  `complet` teste tout en profondeur. En `preview`/`prod`, ce paramètre est
  ignoré : pas de baseline de code pertinente pour une URL déjà déployée,
  donc tout le scénario est joué en profondeur, mutations comprises (§2 bis).
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

## 2. Atteindre la cible

### `env=local`

Toutes les commandes : `config.md` › Environnement (`env=local`). En résumé :

1. **Postgres** : le hook SessionStart le lance ; sinon
   `node .claude/hooks/session-start.mjs`.
2. **Base** : dans un worktree, `pnpm tsx scripts/worktree-db.ts ensure --seed`
   (base propre au worktree, migrée et seedée) ; dans le checkout principal,
   la base de `.env.local`, remise à l'état du seed avec
   `pnpm db:migrate && pnpm tsx scripts/reset-demo.ts` (efface l'usage des
   passes précédentes : les chiffres exacts en dépendent). Le seed est déterministe : LettrePro
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

### `env=preview` ou `env=prod`

Toutes les commandes : `config.md` › Environnements déployés. En résumé :

1. **Pas de serveur, pas de base** : la cible est déjà en ligne. Résous
   l'URL (`config.md` › Cible : `url` du paramètre, sinon la valeur par
   défaut documentée pour `prod` ; obligatoire pour `preview`).
2. **Le proxy sortant du conteneur re-termine le TLS** avec sa propre CA,
   qu'un Chromium fraîchement lancé ne connaît pas : toute navigation échoue
   en `net::ERR_CERT_AUTHORITY_INVALID` sinon (rien à voir avec HTTP/2, qui
   n'a jamais posé de problème une fois la CA acceptée). Épingle son hash
   SPKI, recalculé à chaque passe (`config.md` a la commande et le snippet
   Playwright complet) — jamais `--ignore-certificate-errors` seul ni
   `ignoreHTTPSErrors: true`, qui désactiveraient la vérification TLS en
   général.
3. **`agent-browser` ne passe pas ces options réseau** : utilise directement
   le repli Playwright (§3) pour `preview`/`prod`, il n'est pas un simple
   filet de secours ici.
4. Rien à arrêter en fin de passe.

## 2 bis. Profondeur de la passe

**`env=local`, contre la baseline.** `.claude/qa/route-baseline.json` garde
le hash git de chaque fichier de l'app (`app/`, `lib/`, `messages/`,
`fixtures/`, `proxy.ts`, hors tests) à la fin du dernier run QA dont tous les
constats ont été traités. Seule la skill `qa-orchestrator` le réécrit ; toi,
tu le lis :

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

**`env=preview`/`prod`, toujours en profondeur.** Pas de baseline de code
pertinente pour une URL déjà déployée : chaque étape du scénario est jouée en
profondeur, mutations comprises (génération, inscription, paiement, écriture
admin, reset démo), avec les mêmes variantes qu'en local (§6.5). La colonne
« Profondeur » du rapport dit `complet (déployé)` pour ces étapes. Une étape
reste `NON TESTÉ` si un prérequis technique manque (outil absent, cible
inatteignable), jamais parce que c'est `preview`/`prod`.

## 3. L'outillage

**`env=local`** : deux vues du même serveur, qui se contrôlent l'une l'autre
(skill `next-dev-loop`, à lire : `.claude/skills/next-dev-loop/SKILL.md`).

- **MCP `next-devtools`** (`.mcp.json`) : erreurs de compilation et d'exécution
  (serveur et navigateur), logs, routes, Server Actions du serveur de dev. Ses
  outils peuvent être différés : charge-les avec `ToolSearch`
  (`select:mcp__next-devtools__nextjs_index,mcp__next-devtools__nextjs_call`)
  puis `nextjs_index` pour trouver le serveur et `nextjs_call` (`get_errors`,
  `get_logs`, `get_routes`, `get_server_action_by_id`). Repli si le MCP est
  absent : l'endpoint HTTP `/_next/mcp` du serveur, en `curl` (`config.md`).
  **Après chaque parcours** : `get_errors`, et le journal du serveur. N'existe
  pas sur une cible déployée (pas de serveur de dev) : en `preview`/`prod`,
  seuls la console et le réseau du navigateur font foi.
- **`agent-browser`** (vrai Chrome, piloté par la skill `next-dev-loop`) : DOM,
  snapshot d'accessibilité, console, erreurs de page, réseau, arbre React,
  Suspense en attente. Lance d'abord `agent-browser skills get core` pour
  l'usage exact de la version installée. Headless ici (pas de `--headed`),
  Chromium préinstallé (`config.md`). Contrairement à ce que dit
  next-dev-loop, personne ne se connecte à ta place : tu te connectes
  toi-même avec les comptes de la section 4. Réservé à `env=local` (pas de
  moyen documenté de lui faire passer le proxy et l'épinglage TLS qu'exige
  une URL déployée, §2) : pour `preview`/`prod`, repli Playwright direct.
- **Installation** si absents : `config.md` › Outillage. Si l'installation est
  impossible (réseau), note-le dans le rapport et passe au repli.
- **Repli Playwright** : `@playwright/test` du repo avec le Chromium
  préinstallé (`executablePath: '/opt/pw-browsers/chromium'`), scripts dans le
  scratchpad, jamais commités ; jamais `playwright install`. En
  `preview`/`prod`, c'est la méthode principale, avec les options `proxy` et
  `args` (épinglage SPKI) de `config.md` › Environnements déployés.
- **Shell instantané** : `instant()` de `@next/playwright` (docs/04) n'est pas
  installé ; ne l'installe pas. Vérifie le shell avec le HTML initial
  (`curl`) et `agent-browser react suspense --only-dynamic` (`env=local`).

## 4. Personas et comptes

Détail et identifiants : `config.md` › Personas. Les cinq personas jouent sur
les trois `env` : en `preview`/`prod`, l'admin et l'owner utilisent les
identifiants réels de la démo publique (donnés au paramètre de la skill ou
`SEED_ADMIN_*`/`SEED_OWNER_*` documentés), jamais ceux de `scripts/seed.ts`
qui sont locaux.

| Persona | Entrée | Compte |
|---|---|---|
| Visiteur anonyme, navigation seule | pages publiques (`/{slug}`, `/`, `/{slug}/pricing`…), sans lancer de génération | aucun ; disponible sur les trois `env` |
| Visiteur anonyme, génération gratuite | `/{slug}/tool`, génère réellement | aucun ; cookie `anonymous_id` neuf, IP simulée propre au parcours ; disponible sur les trois `env` (tokens réels en `preview`/`prod`, `AI_MODE=live`) |
| Inscrit | modale `/{slug}/signup`, lien magique via la boîte de réception simulée | jetable, un par parcours ; disponible sur les trois `env` |
| Admin de démo | `/admin/login` | `SEED_ADMIN_*`, ou identifiants fournis pour la passe en `preview`/`prod` ; `DEV_ADMIN` de `scripts/seed.ts` en local seulement |
| Owner | `/admin/login` puis `/admin/ops` | `SEED_OWNER_*`, ou identifiants fournis pour la passe en `preview`/`prod` ; `DEV_OWNER` en local seulement |

N'écris jamais un vrai secret dans le rapport : cite la constante ou la
variable d'environnement.

## 5. Garde-fous

Ces règles s'appliquent sur les trois `env` (décision humaine du
2026-09-27 : plus de restriction « lecture seule » propre à `preview`/`prod`,
`config.md` › Garde-fous en garde le détail). Elles remplacent la prudence
par défaut, pas la vigilance : `preview` et `prod` restent la donnée
partagée que voient les recruteurs (`config.md` › Cible), donc chaque
mutation y est faite comme en local — proprement, journalisée, réversible —
jamais « pour voir ».

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
   Sur les trois `env`, une étape qui exige une mutation (génération,
   inscription, paiement, écriture admin, reset démo) est jouée normalement,
   avec les garde-fous de la section 5.
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
(`env` et, hors `local`, l'URL testée ; SHA du commit si connu ; en local :
branche, base, port, seed, mode et baseline comparée), et, avec `recheck`, la
section « Recheck » : chaque constat du rapport précédent
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
