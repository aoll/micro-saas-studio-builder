# Tooling dev

Une démo reste un repo que le recruteur peut ouvrir, et un studio qui lance plusieurs SaaS vit de socles reproductibles. Le principe retenu : **tout ce qu'une machine peut vérifier, une machine le vérifie**, au même endroit pour les deux « développeurs » du projet :

- moi, dans l'éditeur ;
- l'agent (Claude Code), dans sa boucle.

D'où une commande unique, `pnpm check`, que les deux appellent.

## Qualité du code

### TypeScript strict, et le piège TypeScript 7

`strict` est activé par défaut depuis TypeScript 7.0. On l'écrit quand même dans `tsconfig.json`, pour être explicite, et on ajoute :

- `noUncheckedIndexedAccess` : `rows[0]` devient `Row | undefined`, pratique avec les `returning()` de Drizzle ;
- `noImplicitOverride` ;
- `noFallthroughCasesInSwitch`.

`exactOptionalPropertyTypes` est écarté : trop de frictions avec les types des libs, pour peu de gain sur une démo.

**Point d'attention relevé dans la doc** : TypeScript 7.0 ne fournit pas encore d'API JavaScript. Elle est prévue pour la 7.1.

- **Next.js 16.3 s'en accommode** : `next build` appelle désormais le `tsc` du projet (option `experimental.useTypeScriptCli`, activée par défaut).
- **typescript-eslint, lui, a besoin de cette API.**

On suit donc l'installation côte à côte recommandée par l'équipe TypeScript :

```json
"devDependencies": {
  "@typescript/native": "npm:typescript@^7.0.2",
  "typescript": "npm:@typescript/typescript6@^6.0.2"
}
```

ESLint utilise TypeScript 6. Le script `typecheck` appelle le `tsc` de TypeScript 7 (chemin du binaire à caler au scaffolding). Plan B si ça coince : tout en 6.0 jusqu'à la 7.1.

### ESLint

Depuis Next.js 16, `next lint` n'existe plus et `next build` ne lance plus le lint : c'est pnpm lint, inclus dans pnpm check, qui l'exécute via le CLI ESLint, en config plate.

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // la base n'est lue que par le DAL (cf. onglet Arborescence)
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/lib/db', '@/lib/db/*'], message: 'Passer par lib/dal' }] }],
    },
  },
  { files: ['lib/dal/**'], rules: { 'no-restricted-imports': 'off' } },
  prettier, // en dernier : coupe les règles de mise en forme
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
```

La règle `no-restricted-imports` transforme une convention de l'onglet Arborescence en erreur de lint.

### Prettier

Déjà dans la stack, avec `prettier-plugin-tailwindcss` qui trie les classes Tailwind. `eslint-config-prettier` évite que les deux outils se contredisent (recommandation de la doc Next.js).

### Variables d'environnement validées

`@t3-oss/env-nextjs` dans `lib/env.ts` : un schéma Zod pour les 8 variables. Le fichier est importé dans `next.config.ts`, donc **le build échoue** si `DATABASE_URL` manque ou si `AI_MODE` vaut autre chose que `mock` ou `live`. Le code lit `env.AI_MODE`, typé, et plus jamais `process.env`.

## Git : hooks, commits, PR

### Husky + lint-staged

`pnpm exec husky init` crée `.husky/pre-commit` et le script `prepare`. On n'y garde qu'un seul hook, volontairement léger :

| Hook | Commande | Durée visée |
| --- | --- | --- |
| `pre-commit` | `lint-staged` : `eslint --fix` + `prettier --write` sur les seuls fichiers indexés | quelques secondes |

Il ne lance **ni tests ni typecheck** : en TDD, on pousse volontairement des tests rouges avant le code, et un hook qui bloque ce commit casserait la méthode. Tests et types sont vérifiés par `/verify`, avec des scripts qui prennent eux-mêmes leur place dans les files de concurrence de `scripts/queued.sh`. Pas de `pre-push` ni de `commit-msg` non plus : les commits de branche disparaissent au squash, seul le titre de la PR compte.

### Commits conventionnels

`feat(credits): …`, `fix(bo): …` : l'historique se lit comme un changelog. Les scopes suivent les zones du repo : `bo`, `app`, `credits`, `ai`, `db`, `auth`, `tooling`.

Le dépôt n'autorise que le **squash merge** pour les PR de spec, avec le titre de la PR comme message de commit : la branche d'intégration du run (nommée par l'orchestrateur, créée depuis `main` avec `worktree.ts integration <branche>` et lue avec `git config msb.integration`) compte un commit par feature, et `main` avance à chaque jalon. La règle de titre (type conventionnel et scopes de cette liste) est écrite dans `CLAUDE.md` pour que l'agent titre juste du premier coup, et je la vérifie à la relecture.

### Template de PR

`.github/pull_request_template.md` :

```md
## Why

<!-- The spec (`specs/<REF>-<name>.md`) or the reason for this change. -->

## What changes

-

## How to test

<!-- Vercel preview URL and the steps to follow. -->

## Checklist

- [ ] `/verify` is READY (`pnpm check` green)
- [ ] Tests added or updated
- [ ] Drizzle migration generated and reviewed (if the schema changed)
- [ ] Agent-written code reviewed line by line
```

Commits, titres et descriptions de PR sont rédigés en anglais.

La dernière case rend visible le principe « 100 % produit par agent, 100 % relu par un humain ».

## Previews Vercel

Chaque PR reçoit une URL de preview, sans configuration. C'est elle qu'on colle dans le template de PR. Sur l'environnement Preview : `AI_MODE=mock`, pour qu'une preview ne consomme jamais de tokens.

## Hygiène du repo

- **Versions épinglées** :
  - `.nvmrc` sur Node 22 (requis par l'AI SDK 7), et `engines` aligné dessus ;
  - `packageManager: "pnpm@…"` dans `package.json` : Corepack et Vercel utilisent la même version de pnpm que moi.
- **Éditeur** :
  - `.editorconfig` ;
  - `.vscode/extensions.json`, qui recommande ESLint, Prettier et Tailwind ;
  - `.vscode/settings.json` : formatage à l'enregistrement, et version de TypeScript du workspace, pour activer le plugin TS de Next.js (erreurs sur `'use client'`, options de segment…).
- **Knip** : détecte fichiers, exports et dépendances inutilisés. Très utile sur un repo écrit par un agent, qui laisse volontiers des restes. Il fait partie de `pnpm check`, donc tourne en local, dans `/verify`.
- **`.env.example`** : les 8 variables, sans valeurs, synchronisées avec `lib/env.ts`.

## Outillage agentique

L'onglet Next.js couvre déjà le côté framework : `AGENTS.md` géré par `next dev`, `next-devtools-mcp`, et les skills. Ici, on branche l'agent sur le même outillage que moi :

- **`CLAUDE.md`** liste les commandes (`pnpm check`, `pnpm db:seed`, `pnpm test:e2e`) et les règles du repo (DAL, `server-only`, imports). Il renvoie vers l'onglet Arborescence plutôt que de le dupliquer.
- **Hooks Claude Code** (`.claude/settings.json`) :
  - `PostToolUse` : ESLint et Prettier sur le fichier que l'agent vient d'écrire ;
  - `Stop` : un simple avertissement si du travail n'est pas commité ou pas poussé. Pas de `pnpm check` à chaque fin de tour : avec jusqu'à 10 worktrees en parallèle, des typecheck et des suites de tests simultanés saturent la mémoire. Les checks passent par `/verify`, et chaque script lourd attend un slot machine (voir les scripts plus bas).
- **`specs/`** : une spec courte par écran (BO-01…, SA-01…) ou par mécanique (ledger, mode démo). L'agent l'implémente en TDD, et la PR y renvoie : c'est le développement piloté par les specs, appliqué à la démo.

## Récapitulatif

| Outil | Rôle | Quand |
| --- | --- | --- |
| TypeScript strict (+ `noUncheckedIndexedAccess`) | Types | v1 |
| ESLint (config Next + règle DAL) + Prettier | Lint, format | v1 |
| `@t3-oss/env-nextjs` | Env validée au build | v1 |
| Husky + lint-staged | pre-commit : format et lint des fichiers indexés | v1 |
| Template de PR | Revue | v1 |
| Previews Vercel en `AI_MODE=mock` | Recette par PR | v1 |
| `.nvmrc`, `packageManager`, `.editorconfig`, `.vscode/` | Reproductibilité | v1 |
| `CLAUDE.md` + hooks Claude Code + `specs/` | Agent | v1 |
| Knip | Hygiène | v1 |

**Scripts à ajouter** :

```json
"typecheck": "scripts/queued.sh typecheck sh -c 'next typegen && tsc --noEmit'",
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check .",
"knip": "knip",
"test": "scripts/queued.sh test vitest run",
"test:coverage": "scripts/queued.sh test vitest run --coverage",
"test:e2e": "scripts/queued.sh e2e playwright test",
"check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm knip && pnpm test",
"prepare": "husky"
```

**Les files sont dans les scripts.** `typecheck`, `test` et `test:coverage` attendent l'un des 4 slots de leur file, `test:e2e` l'unique slot E2E, quel que soit le worktree qui les lance. Les agents appellent donc simplement `pnpm typecheck` ou `pnpm test` ; un fichier de test seul (`pnpm vitest run <fichier>`) tourne sans file, c'est la boucle TDD. On n'enveloppe jamais ces scripts dans un second `scripts/queued.sh` : l'appel imbriqué attendrait un deuxième slot de la file qu'il tient déjà.

**Dépendances** :

```bash
pnpm add @t3-oss/env-nextjs
pnpm add -D husky lint-staged eslint-config-prettier knip
```

## Sources

Consultées le 24 septembre 2026 :

- [Next.js — ESLint plugin](https://nextjs.org/docs/app/api-reference/config/eslint) (suppression de `next lint`, intégration Prettier et lint-staged)
- [Next.js — TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript) · [useTypeScriptCli](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)
- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (pas d'API avant la 7.1, installation côte à côte)
- [typescript-eslint — support de TS 7](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
- [Husky — Get started](https://typicode.github.io/husky/get-started.html)
- [T3 Env — Next.js](https://env.t3.gg/docs/nextjs)
