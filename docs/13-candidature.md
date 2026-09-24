# Candidature

Comment la démo est construite dans le temps, puis présentée à Dotworld.

## Planning

**Environ 14,5 jours de travail, soit 3 semaines à temps plein**, en delivery agentique (SDD + TDD, relecture humaine). L'ordre est pensé pour avoir une démo présentable dès la fin de la semaine 1, puis l'enrichir.

| # | Lot | Contenu | Estimation |
| --- | --- | --- | --- |
| 1 | Socle | Next.js 16.3 et ses flags, Drizzle, Better Auth, DAL, deux root layouts, `AGENTS.md`, MCP | 1 j |
| 2 | Schéma produit | Schéma Zod de config, tables, CRUD dans le DAL | 0,5 j |
| 3 | Sub-app et thèmes | Route `[app]`, landing, 4 thèmes, i18n fr / en (next-intl), SEO, cache | 2,5 j |
| 4 | Génération | Route Handler streamé, AI SDK, mock et fixtures, historique | 1,5 j |
| 5 | Crédits et paiement | Ledger, idempotence, remboursement, modales inscription et paiement simulés | 1,5 j |
| 6 | Formulaire produit | BO-05 en 7 étapes, aperçu en direct, « Tester le prompt » | 2 j |
| 7 | Tracking et dashboards | Events, funnel, portefeuille, fiche produit, statuts | 2 j |
| 8 | Mode démo et contenu | Compte démo, remise à zéro, rédaction des 4 produits seedés | 1,5 j |
| 9 | Finition et package | Tests e2e et `instant()`, déploiement, README, vidéo | 2 j |
|  | **Total** |  | **\~14,5 j** |

**Jalons**

- **Fin de semaine 1 (lots 1 à 5)** : le parcours utilisateur complet fonctionne sur un produit seedé, de la landing à l'achat. Déjà montrable.
- **Fin de semaine 2 (lots 6 et 7)** : création d'un produit depuis le backoffice et dashboards. Le script de démo complet passe.
- **Semaine 3 (lots 8 et 9)** : mode démo, contenu, vidéo, envoi.

**Si ça déborde, on coupe dans cet ordre** :

1. Éditeur de thème (BO-08) : les 4 thèmes seedés suffisent.
2. Fiche activité (BO-04) et page compte (SA-07).
3. Changement de statut en modale (BO-06) : un simple menu déroulant.
4. Aperçu en direct dans BO-05 : un bouton « Voir la landing ».

On ne coupe jamais : le ledger et ses tests, la création d'un produit en direct, le funnel, la vidéo.

## Le package envoyé à Dotworld

Un recruteur ne clonera pas le repo et n'aura peut-être que deux minutes. Le package est pensé pour fonctionner **à trois niveaux d'attention** : 30 secondes (le message), 2 minutes (la vidéo), 10 minutes (la démo en ligne et le repo).

| Élément | Contenu | Pour qui |
| --- | --- | --- |
| Message d'accompagnement | 5 ou 6 lignes : ce que j'ai construit, pourquoi ça parle à leur métier, les 3 liens | Recruteur, 30 s |
| Vidéo | 2 min, qui suit le script de démo : portefeuille, création d'un produit, parcours utilisateur, retour au dashboard | Recruteur et lead technique |
| Démo en ligne | URL publique ; identifiants admin fournis dans le message ; bandeau « Démo » rappelant que paiement et email sont simulés | Qui veut cliquer |
| Repo GitHub | `github.com/aoll/micro-saas-studio-builder` : code, specs, tests, historique de PR. Description du repo : « Backoffice Next.js 16 qui lance un micro-SaaS IA en quelques minutes et le pilote par la donnée : Test → Learn → Scale. » | Lead technique |
| README | Voir ci-dessous | Lead technique |

**Structure du README**

1. Ce que c'est, en 3 lignes, avec une capture et le lien vers la vidéo.
2. Pourquoi : le lien avec le modèle d'un SaaS studio (plusieurs produits, socle commun, Test / Learn / Scale).
3. Ce que ça montre techniquement : Next.js 16.3 (Cache Components, root params, intercepting routes), AI SDK, ledger de crédits idempotent.
4. **Comment c'est construit** : specs, TDD, part du code produite par agents, relecture humaine, durée réelle. C'est la partie qui répond à « We develop with AI, not alongside it ».
5. Lancer en local en 3 commandes, en mode mock (sans clé IA).
6. Ce que je ferais ensuite : vrai paiement, A/B tests, produits à sortie image.

**Brouillon du message**

> Bonjour, en découvrant votre modèle de SaaS studio, j'ai construit une démo qui en reprend le principe : un backoffice qui lance un micro-SaaS IA en quelques minutes et le pilote par la donnée, jusqu'à la décision de le garder ou de le couper. Next.js 16.3, AI SDK, crédits, thèmes partagés ; livré en delivery agentique avec Claude Code, specs et tests à l'appui. Vidéo (2 min) : \[lien\] · Démo : \[lien\] (accès admin : \[identifiant\] / \[mot de passe\]) · Code : \[lien\]. Je serais ravi d'en parler.

## Préparer l'entretien

**Trois messages à faire passer**, quelle que soit la question :

1. **J'ai compris votre métier** : plusieurs produits, un socle commun, des décisions prises sur la donnée (funnel, marge, statut Test / Learn / Scale).
2. **Je livre vite et proprement avec des agents** : specs, tests, relecture, et les outils agents officiels de Next.js.
3. **Je sais où mettre la rigueur** : le ledger de crédits (argent), la sécurité des Server Actions, le coût IA par génération. Et je sais simplifier ailleurs (paiement simulé, pas de Redis, pas de glisser-déposer).

**Questions attendues**

| Question | Éléments de réponse |
| --- | --- |
| Pourquoi pas de vrai Stripe ? | Le sujet est la logique de crédits ; `purchase()` est le seul point à brancher sur un webhook, le modèle de données ne change pas |
| Comment ça tiendrait à 50 M de visiteurs ? | Landings pré-rendues (CDN), cache tagué, events à sortir vers un entrepôt de données, rate limit vers Redis, cache `use cache: remote` |
| Quelle part du code a été écrite par des agents ? | Le chiffre réel, les specs, les tests, et ce que la relecture humaine a corrigé |
| Pourquoi l'AI SDK plutôt que le SDK Anthropic ? | Modèle configurable par produit, produits image, streaming UI, coût par génération |
| Qu'est-ce qui a été le plus dur ? | À noter pendant le projet, avec un exemple concret |
| Et une v2 ? | A/B tests avec le Flags SDK, produits image, vrai paiement, entrepôt de données pour le funnel |

**Le jour J** : réinitialiser la démo depuis la page cachée, ouvrir le portefeuille une minute avant (réveil de la base), vérifier le crédit AI Gateway, et garder `AI_MODE=mock` en solution de secours si l'API IA tombe.

## Registre des risques

| Risque | Probabilité | Parade |
| --- | --- | --- |
| Un visiteur modifie ou « tue » les produits seedés avant l'entretien | Haute | Produits seedés verrouillés, remise à zéro nocturne et bouton « Réinitialiser » (mode démo, onglet principal) |
| API IA lente ou indisponible pendant la démo live | Faible | Fallback de modèle via le Gateway ; bascule `AI_MODE=mock` |
| Sortie IA déplacée générée en direct | Faible | Consignes de sûreté dans le prompt système, limites sur les entrées (onglet IA) |
| Base en veille au moment de la démo | Moyenne | Ouvrir l'app une minute avant, ou désactiver la mise en veille le jour J |
| Budget IA épuisé par un bot | Faible | Budget plafonné, BotID, rate limit Postgres |
| Le planning déborde | Moyenne | Liste de coupes du planning ; le jalon de fin de semaine 1 est déjà montrable |
| Une API de Next.js 16.3 évolue (flags récents) | Faible | Version figée dans `package.json`, docs locales via `AGENTS.md` |
| Vercel Hobby jugé inadapté (usage non commercial) | Faible | Passage sur Pro (20 $ par mois) |
