# Dossier de conception

Export markdown du dossier de conception (en français), onglet par onglet. C'est
la source de vérité du projet : écrans, modèle de données, contrats, décisions.
Les specs, elles, vivent dans `specs/` (index et conventions : `specs/README.md`).

**Pour un agent : ce dossier est le contexte de ta spec. Avant de commencer,
lis chacun des fichiers ci-dessous en entier, dans l'ordre, pas seulement les
sections citées par `Réf`.**

| Fichier | Contenu |
|---------|---------|
| `00-accueil.md` | Vue d'ensemble de la démo et du dossier |
| `01-produit.md` | Pitch, parcours, configuration d'un produit, thèmes, crédits, backoffice, mode démo, architecture |
| `02-ecrans.md` | Les écrans BO-xx et SA-xx : routes, contenu, états |
| `03-maquettes.md` | Maquettes fil de fer par écran (images dans `specs/mockups/`) |
| `04-nextjs.md` | Choix Next.js 16.3 : rendu, cache, routes, Server Actions, sources |
| `05-ia.md` | AI SDK, AI Gateway, mode mock et fixtures, coûts IA |
| `06-vercel.md` | Hébergement et services Vercel |
| `07-modele-de-donnees.md` | Tables, contraintes, invariants, index, ledger de crédits |
| `08-stack.md` | Librairies, scripts, variables d'environnement, i18n |
| `09-arborescence.md` | Arborescence du repo et règles d'import |
| `10-tooling-dev.md` | Qualité du code, git, template de PR, outillage agentique |
| `11-implementation.md` | Méthode : boucle d'une spec, contrats gelés, vagues, orchestration, monitoring |
| `12-couts.md` | Coûts de la démo |
| `13-candidature.md` | Contexte de la candidature et planning |

Le dossier original est un document partagé ; ces fichiers en sont un export.
Une modification du dossier se fait là-bas, puis l'export est rafraîchi ici.
