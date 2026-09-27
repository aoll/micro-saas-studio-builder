---
name: architecture-graph
description: >
  Régénère le graphe de connaissances du repo (Understand-Anything : scan
  tree-sitter, agents file-analyzer en parallèle, couches d'architecture,
  tour guidé) et le dashboard statique qui l'explore, publié sur
  `/architecture` et lié depuis la landing. Utiliser après un changement
  significatif du code (nouvelles routes, refonte de dossiers, nouveau
  domaine métier) pour que `/architecture` reste à jour ; sinon le graphe se
  contente de vieillir silencieusement, personne ne le régénère tout seul.
---

# Graphe d'architecture et dashboard statique

Reproduit intégralement ce qui a été fait la première fois (session du
27/09/2026) : le vrai pipeline `/understand` d'Understand-Anything (plugin
Claude Code, pas une approximation), suivi d'un build statique de leur
dashboard, patché pour fonctionner sans backend, publié dans
`public/architecture/`.

**Coût** : ce n'est pas gratuit. Le scan est déterministe et rapide, mais la
Phase 2 dispatche un agent LLM par lot de ~25-30 fichiers (une quinzaine
d'agents pour ce repo), plus 3 agents pour l'architecture, le tour et la
revue d'assemblage — plusieurs dizaines de minutes et un coût réel en
tokens. Ne relance pas cette skill pour un changement mineur.

## 0. Pré-requis : installer le plugin

Le plugin ne survit pas d'une session à l'autre dans cet environnement
(sandbox éphémère) — à refaire à chaque fois :

```bash
claude plugin marketplace add Egonex-AI/Understand-Anything
claude plugin install understand-anything@understand-anything
```

Résous ensuite `PLUGIN_ROOT` (le numéro de version change à chaque release
amont) et build `@understand-anything/core` (nécessaire aux scripts des
phases suivantes) :

```bash
PLUGIN_ROOT=$(dirname "$(ls -d ~/.claude/plugins/cache/understand-anything/understand-anything/*/ | tail -1)")/$(basename "$(ls -d ~/.claude/plugins/cache/understand-anything/understand-anything/*/ | tail -1)")
SKILL_DIR="$PLUGIN_ROOT/skills/understand"
PROJECT_ROOT="$(pwd)"   # le checkout principal, jamais un worktree (docs/09)
UA_DIR="$PROJECT_ROOT/.ua"

cd "$PLUGIN_ROOT" && pnpm install --frozen-lockfile && pnpm --filter @understand-anything/core build
cd "$PROJECT_ROOT"
```

**Important** : ce `pnpm install` ne fonctionne QUE dans le cache du plugin
officiellement installé (`~/.claude/plugins/...`). Ne clone jamais le repo
Understand-Anything à la main pour lui faire `pnpm install` ailleurs — le
sandbox le refuse (classificateur "Code from External"), à raison : seul le
mécanisme officiel `claude plugin install` est un chemin de confiance.

## 1. Le graphe (Phases 0 à 7 du vrai pipeline)

Suis `$SKILL_DIR/SKILL.md` (le vrai fichier agent, à lire en entier — c'est
la référence, ce qui suit n'en est qu'un résumé d'exécution) :

1. **Phase 0/0.5** : `mkdir -p "$UA_DIR/intermediate" "$UA_DIR/tmp"`. Le
   `.understandignore` de ce repo existe déjà et est commité
   (`.ua/.understandignore`) — ne le régénère pas, il encode déjà les choix
   de scope (exclut `.claude/`, `messages/`, `specs/`, `fixtures/`,
   `drizzle/`, les tests) ; ajuste-le à la main si le scope doit changer.
2. **Phase 1 (scan)** :
   ```bash
   node "$SKILL_DIR/scan-project.mjs" "$PROJECT_ROOT" "$UA_DIR/intermediate/scan-result.json"
   node -e "const fs=require('fs'),p='$UA_DIR/intermediate/scan-result.json';const d=JSON.parse(fs.readFileSync(p));d.projectRoot='$PROJECT_ROOT';fs.writeFileSync(p,JSON.stringify(d))"
   node "$SKILL_DIR/extract-import-map.mjs" "$UA_DIR/intermediate/scan-result.json" "$UA_DIR/intermediate/import-map-output.json"
   node -e "const fs=require('fs');const s='$UA_DIR/intermediate/scan-result.json',i='$UA_DIR/intermediate/import-map-output.json';const scan=JSON.parse(fs.readFileSync(s));scan.importMap=JSON.parse(fs.readFileSync(i)).importMap;fs.writeFileSync(s,JSON.stringify(scan))"
   ```
   (`extract-import-map.mjs` écrase son fichier de sortie avec un objet qui
   n'a plus `files` — ne jamais lui donner `scan-result.json` comme cible,
   toujours un fichier séparé, puis fusionner `importMap` à la main comme
   ci-dessus.)
3. **Phase 1.5 (lots)** : `node "$SKILL_DIR/compute-batches.mjs" "$PROJECT_ROOT"`
   → `$UA_DIR/intermediate/batches.json`, ~25-30 fichiers par lot.
4. **Phase 2 (analyse, en parallèle)** : pour chaque `batchIndex` de
   `batches.json`, dispatche un agent (outil Agent, `subagent_type:
   general-purpose`, par vagues de 5 en même temps) qui :
   - lit en entier `$PLUGIN_ROOT/agents/file-analyzer.md` et l'applique à la
     lettre ;
   - récupère lui-même son lot dans `batches.json` (`files`,
     `batchImportData`, `neighborMap`) plutôt que de le recevoir copié dans
     le prompt ;
   - écrit `$UA_DIR/intermediate/batch-<N>.json` (ou `-part-<k>.json`).

   Contexte à donner à chaque agent dans le prompt (nom, description,
   frameworks du projet) : reprends le texte de
   `.claude/skills/architecture-graph/project-context.md`.

   Une fois tous les lots écrits :
   ```bash
   python3 "$SKILL_DIR/merge-batch-graphs.py" "$PROJECT_ROOT"
   ```
   → `$UA_DIR/intermediate/assembled-graph.json`. Lis le rapport stderr
   (« Could not fix ») : s'il liste des arêtes tombées, c'est la matière du
   Phase 3 suivant.
5. **Phase 3 (revue d'assemblage)** : un agent qui lit
   `$PLUGIN_ROOT/agents/assemble-reviewer.md`, corrige `assembled-graph.json`
   en place (récupère les noeuds/arêtes du rapport « Could not fix », vérifie
   les imports croisés contre `$IMPORT_MAP`).
6. **Phase 4 (couches)** : un agent qui lit
   `$PLUGIN_ROOT/agents/architecture-analyzer.md`, écrit
   `$UA_DIR/intermediate/layers.json`. Donne-lui le contexte projet (mêmes
   infos que Phase 2) et signale que `app/(backoffice)` et
   `app/(products)/[app]` sont deux zones quasi indépendantes (vrai à la
   dernière analyse : 2 imports croisés sur 654) — l'agent le retrouve de
   toute façon par le script structurel, mais ça accélère.
7. **Phase 5 (tour)** : un agent qui lit `$PLUGIN_ROOT/agents/tour-builder.md`,
   écrit `$UA_DIR/intermediate/tour.json`, **en français**, 5 à 15 étapes.
8. **Assemblage final + validation (Phase 6)** :
   ```bash
   node -e "
   const fs = require('fs');
   const graph = JSON.parse(fs.readFileSync('$UA_DIR/intermediate/assembled-graph.json'));
   const layers = JSON.parse(fs.readFileSync('$UA_DIR/intermediate/layers.json'));
   const tour = JSON.parse(fs.readFileSync('$UA_DIR/intermediate/tour.json'));
   const full = {
     version: '1.0.0',
     project: {
       name: 'micro-saas-studio-builder',
       languages: ['typescript', 'markdown'],
       frameworks: ['Next.js', 'React', 'Tailwind CSS', 'Drizzle ORM', 'Better Auth', 'AI SDK', 'next-intl', 'Zod', 'Vitest', 'Playwright'],
       description: 'Backoffice Next.js 16 pour un SaaS studio qui lance des micro-SaaS IA a credits en quelques minutes et les pilote par la donnee (statuts Test / Learn / Scale / Killed).',
       analyzedAt: new Date().toISOString(),
       gitCommitHash: require('child_process').execSync('git rev-parse HEAD').toString().trim(),
     },
     nodes: graph.nodes, edges: graph.edges, layers, tour,
   };
   fs.writeFileSync('$UA_DIR/intermediate/assembled-graph.json', JSON.stringify(full));
   "
   node ".claude/skills/architecture-graph/inline-validate.mjs" "$UA_DIR/intermediate/assembled-graph.json" "$UA_DIR/intermediate/review.json"
   cat "$UA_DIR/intermediate/review.json"
   ```
   `issues` doit être vide (sinon corrige à la main avant de continuer —
   c'est le même schéma que Phase 6 de leur SKILL.md). Les `warnings`
   « orphan » sur les fichiers racine (README, package.json…) sont normaux.

   **Vérifie qu'aucun noeud ne référence `.ua/` lui-même**
   (`config:.ua/intermediate/scan-result.json` ou similaire) — c'est arrivé
   une fois parce que `.ua/` n'était pas encore dans `.understandignore` au
   moment du scan ; si ça se reproduit, retire le noeud à la main et ajoute
   `.ua/` à `.understandignore`.
9. **Sauvegarde (Phase 7)** :
   ```bash
   cp "$UA_DIR/intermediate/assembled-graph.json" "$UA_DIR/knowledge-graph.json"
   node -e "
   const fs = require('fs');
   const scan = JSON.parse(fs.readFileSync('$UA_DIR/intermediate/scan-result.json'));
   fs.writeFileSync('$UA_DIR/intermediate/fingerprint-input.json', JSON.stringify({
     projectRoot: '$PROJECT_ROOT',
     filePaths: scan.files.map(f => f.path),
     gitCommitHash: require('child_process').execSync('git rev-parse HEAD').toString().trim(),
   }));
   "
   node "$SKILL_DIR/build-fingerprints.mjs" "$UA_DIR/intermediate/fingerprint-input.json"
   node -e "
   const fs = require('fs');
   fs.writeFileSync('$UA_DIR/meta.json', JSON.stringify({
     lastAnalyzedAt: new Date().toISOString(),
     gitCommitHash: require('child_process').execSync('git rev-parse HEAD').toString().trim(),
     version: '1.0.0',
     analyzedFiles: JSON.parse(fs.readFileSync('$UA_DIR/intermediate/scan-result.json')).files.length,
   }, null, 2));
   "
   npx prettier --write .ua/knowledge-graph.json .ua/meta.json .ua/fingerprints.json
   rm -rf "$UA_DIR/intermediate" "$UA_DIR/tmp"
   mkdir -p "$UA_DIR/intermediate" "$UA_DIR/tmp"
   ```

## 2. Le contenu des fichiers pour le viewer de code

```bash
node ".claude/skills/architecture-graph/generate-source-files.mjs" \
  "$PROJECT_ROOT" "$UA_DIR/knowledge-graph.json" "$UA_DIR/source-files-tmp.json"
```

## 3. Le dashboard statique, patché

Le patch (`.claude/skills/architecture-graph/codeviewer-static-demo.patch`)
fait fonctionner le bouton « Open code » sans backend — voir la discussion
de la session du 27/09/2026 pour le choix (le code est déjà public sur
GitHub, donc `source-files.json` ne fuite rien de nouveau ; c'était le
compromis retenu, pas une évidence — redemande si ça change).

```bash
cd "$PLUGIN_ROOT/packages/dashboard"
patch -p1 --dry-run < "$PROJECT_ROOT/.claude/skills/architecture-graph/codeviewer-static-demo.patch" \
  && patch -p1 < "$PROJECT_ROOT/.claude/skills/architecture-graph/codeviewer-static-demo.patch"
rm -rf dist
npx vite build --config vite.config.demo.ts --base=/architecture/
cd "$PROJECT_ROOT"

rm -rf public/architecture
mkdir -p public/architecture
cp -r "$PLUGIN_ROOT/packages/dashboard/dist/." public/architecture/
cp "$UA_DIR/knowledge-graph.json" public/architecture/knowledge-graph.json
cp "$UA_DIR/source-files-tmp.json" public/architecture/source-files.json
rm "$UA_DIR/source-files-tmp.json"
```

`public/architecture/LICENSE` (attribution MIT + note sur
`source-files.json`) est déjà commité — ne le régénère que si son contenu a
vraiment besoin de changer.

## 4. Vérifier avant de commiter

`eslint.config.mjs`, `.prettierignore` et `knip.json` ignorent déjà
`public/architecture/**` (approuvé le 27/09/2026, pas besoin de redemander
sauf si ces fichiers changent de forme) :

```bash
pnpm lint && pnpm format:check
DATABASE_URL="postgres://postgres:postgres@localhost:5432/msb" BETTER_AUTH_SECRET="x".repeat(32) \
  BETTER_AUTH_URL="http://localhost:3000" AI_MODE=mock DEMO_MODE=false \
  AI_GATEWAY_API_KEY=x BLOB_READ_WRITE_TOKEN=x CRON_SECRET=x pnpm knip
```

Ouvre `public/architecture/index.html` dans un navigateur (`python3 -m
http.server` depuis `public/`, ou `pnpm dev` une fois committé) et vérifie
au moins : le graphe se charge, une recherche renvoie un résultat, « Open
code » sur un fichier affiche du vrai code.

## 5. Commit

Deux commits séparés, comme la première fois : un pour `.ua/` (le graphe,
data), un pour `public/architecture/` (le dashboard buildé). Mentionne dans
le message le commit du repo sur lequel l'analyse a tourné
(`gitCommitHash` de `meta.json`), pour qu'on sache si `/architecture` est à
jour par rapport au code.
