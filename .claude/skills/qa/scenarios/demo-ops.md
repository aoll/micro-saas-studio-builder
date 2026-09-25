# Scénario demo-ops · Mode démo, sécurité et remise à zéro

## Objectif

Vérifier ce qui protège la démo publique et ce qu'on en voit en local : la
page cachée `/admin/ops` réservée à l'owner et sa remise à zéro, le bandeau
« Démo », le rate limit des générations, le contournement de BotID hors
Vercel, et les limites du parcours anonyme. À lancer après DEMO-mode,
SECURITY ou un changement de `scripts/reset-demo.ts`.

## Specs et docs couvertes

DEMO-mode (avec ses notes de run : pas de verrou, pas de plafond de produits),
SECURITY, SA-02 (limite anonyme), BO-01. docs/01 › Mode démo public ; docs/06 ›
BotID ; docs/08 › Rate limit dans Postgres, variables ; docs/09 › `admin/ops`.

## Personas

Visiteur anonyme, inscrit jetable (avec des crédits), admin de démo, owner.

## Préconditions

Base seedée, serveur lancé avec `DEMO_MODE=false`. Pour l'étape 2, un second
lancement avec `DEMO_MODE=true` (sans re-seed). Pour l'étape 6, un lancement
avec `GENERATION_RATE_LIMIT_PER_MINUTE=3` est permis pour éviter d'acheter
des crédits ; le noter dans le rapport. **Ce scénario efface l'usage des
visiteurs à l'étape 10.**

## Étapes

1. Aucun lien vers `/admin/ops` dans la navigation du BO ni ailleurs (`grep -rn "admin/ops" app components`). [docs/01 › Mode démo · docs/09]
2. `DEMO_MODE=true` : bandeau « Démo : paiement et email simulés » sur chaque sub-app, discret, lisible en mobile ; absent du BO. `DEMO_MODE=false` : absent. [CONTRACT-ui › 4 · docs/01 › Signal visuel]
3. `/admin/ops` en anonyme, en inscrit, en admin de démo → 404 (vraie 404, pas une redirection vers le login). [DEMO-mode › 2]
4. Owner (`DEV_OWNER`) via `/admin/login` → `/admin/ops` : « Opérations », « Réinitialiser la démo ». Le premier clic n'efface rien : il affiche l'avertissement et « Annuler » / « Confirmer la réinitialisation » ; « Annuler » revient à l'état initial. [DEMO-mode › 2]
5. Limite anonyme : sur `/lettre-pro/tool`, une génération gratuite ; même cookie → 401 `signup_required` ; nouveau contexte, **même** IP simulée → refus aussi ; nouvelle IP simulée → autorisé. [SA-02 › 4 · docs/01 › Anonyme « cookie et IP »]
6. Rate limit : un inscrit avec des crédits enchaîne `N + 1` générations en moins de 60 s (N = `GENERATION_RATE_LIMIT_PER_MINUTE`) → la dernière répond 429 et l'outil affiche « Trop de générations en peu de temps, réessayez dans un instant. » ; aucun crédit débité pour la requête refusée ; après 60 s, ça repasse. [SECURITY › 2 · docs/08 › Rate limit]
7. BotID hors Vercel : `VERCEL` n'est pas posée ; aucune génération, inscription, achat ni « Tester le prompt » ne répond 403 `bot` pendant la passe ; `initBotId` présent dans `instrumentation-client.ts`. [SECURITY › 1 · docs/06 › BotID]
8. Pas de verrou : l'admin de démo peut modifier un produit, un thème et les seuils seedés (note de run #44) ; pas de plafond de produits visiteurs (#45). Restaurer ce qui a été modifié. [DEMO-mode › notes de run]
9. Avant la remise à zéro : noter le nombre de produits du portefeuille, les produits visiteurs (BioInsta…), et un compte jetable créé plus tôt.
10. Owner : « Réinitialiser la démo » → « Confirmer la réinitialisation » → toast « Démo réinitialisée » ; produits visiteurs supprimés, comptes jetables supprimés (le lien magique ne les reconnecte plus avec leurs crédits), portefeuille revenu aux 3 produits et aux badges du seed, thèmes et seuils seedés restaurés. [DEMO-mode › 2 · docs/07 › Migrations et seed]
11. Admin et owner se connectent toujours après la remise à zéro. [docs/01 › Remise à zéro]

## Nettoyage

La remise à zéro a déjà rejoué le seed ; lancer quand même `pnpm db:seed`
(idempotent) si l'étape 10 a échoué. Relancer le serveur avec
`DEMO_MODE=false` et sans surcharge du rate limit.
