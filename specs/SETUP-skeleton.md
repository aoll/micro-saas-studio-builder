# SETUP · Walking skeleton (local d'abord)
Réf         : Stack (librairies, scripts, env) · Tooling dev (tout) · Arborescence
              · Next.js (flags 16.3)
Contrat     : getSession(), requireAdmin() dans lib/dal/session.ts (réels, définitifs)
Acceptation :
- next.config.ts active cacheComponents, partialPrefetching, reactCompiler, typedRoutes
- lib/env.ts valide les 8 variables ; build en échec si l'une manque
- Table products minimale (id, slug, name) ; /demo affiche « demo » lu en base
- /admin sans session → redirection /admin/login ; le compte admin seedé se connecte
  (email + mot de passe) ; un compte role=user est refusé
- Better Auth : plugins emailAndPassword (admin) et magicLink (sendMagicLink stocke le
  lien, n'envoie rien) et nextCookies() en dernier
- pnpm check vert ; hook pre-commit (lint-staged)
- AGENTS.md, CLAUDE.md, .mcp.json (next-devtools-mcp), docs/ (export du dossier) présents
Périmètre   : tout le repo (première PR)
Hors périmètre : schéma complet (CONTRACT-data), thèmes et layouts finaux (CONTRACT-ui),
                 déploiement Vercel et base Neon (branchés plus tard ; tout tourne en local,
                 Postgres local et AI_MODE=mock)
