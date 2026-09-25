# Scénario themes · Bibliothèque, éditeur et thèmes appliqués

## Objectif

Vérifier la mutualisation du studio (docs/01 › Thèmes) : 4 thèmes en base,
chacun appliqué sans flash à ses sub-apps en clair et en sombre, et une
modification de thème qui se propage à tous ses produits. À lancer après
BO-07, BO-08, CONTRACT-ui ou un changement de `lib/fonts.ts`.

## Specs et docs couvertes

BO-07, BO-08, CONTRACT-ui (layout `[app]`, variables CSS), SA-01 (variantes de
landing). docs/01 › Thèmes ; docs/02 › BO-07, BO-08 ; docs/04 › Thèmes,
polices et images, `updateTag('theme:…')` ; docs/07 › themes ; mockups BO-07,
BO-08, SA-01.

## Personas

Admin de démo ; visiteur anonyme.

## Préconditions

Base seedée, serveur lancé. Noter les tokens du thème Editorial avant l'étape 5.

## Étapes

1. `/admin/themes` : grille de 4 vignettes (Editorial, Neon, Corporate, Playful), vraies mini-landings rendues avec les tokens (pas des images), nombre de produits par thème (Editorial 1, Corporate 1, Playful 1, Neon 0 ou 1 selon BioInsta). [BO-07 · mockup BO-07 · docs/04 › Vignettes]
2. Chaque sub-app seedée applique son thème : `/lettre-pro` Editorial (serif, `centered`), `/descri-pro` Corporate (`minimal`), `/nom-de-marque` Playful. Lire `--primary` sur `<html>` et comparer aux tokens du seed. [CONTRACT-ui › 2-3 · SA-01 › 2]
3. Clair et sombre (`agent-browser set media dark`) : chaque thème a ses deux jeux de tokens, pas de flash du thème par défaut au chargement, pas de JavaScript de thème. [docs/02 › Sub-app · docs/04 › Thèmes]
4. `/admin/themes/<id Editorial>` : Couleurs (Clair / Sombre), Typographie (« Police » : liste fermée du catalogue `lib/fonts.ts`, pas un champ libre), Forme (« Radius »), Landing (« Variante de landing »), aperçu à droite, avertissement « utilisé par N produits ». [BO-08 › 1-2 · mockup BO-08 · docs/04 › Polices]
5. Changer la couleur primary claire d'Editorial, « Enregistrer » → toast ; `/lettre-pro` montre la nouvelle couleur à la requête suivante, sans redéploiement ; la vignette de `/admin/themes` aussi. [BO-08 › 2 · docs/04 › mutualisation]
6. Token invalide (couleur non parsable, radius vide) → « Ce thème contient des erreurs. », rien d'enregistré. [BO-08 · docs/07 › tokens validés par Zod]
7. Changer la variante de landing d'Editorial → `/lettre-pro` change de mise en page ; restaurer. [SA-01 › 2 · docs/01 › Variante de landing]
8. « Annuler » revient à `/admin/themes` sans enregistrer. [BO-08]
9. Dans le formulaire produit (`/admin/products/new`, étape Thème) : les vignettes suivent le thème modifié. [docs/04 › Vignettes]

## Nettoyage

Restaurer les tokens et la variante d'Editorial notés avant l'étape 5, et
vérifier `/lettre-pro` une dernière fois.
