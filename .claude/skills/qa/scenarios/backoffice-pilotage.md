# Scénario backoffice-pilotage · Décider sur la donnée

## Objectif

Vérifier que le backoffice répond à « ce produit, on le pousse ou on le
coupe ? » (docs/01 › Backoffice) avec les chiffres du seed : accès, portefeuille,
fiche, activité, changement de statut, seuils. À lancer après BO-01 à BO-04,
BO-06, BO-09 ou TRACKING.

## Specs et docs couvertes

BO-01, BO-02, BO-03, BO-04, BO-06, BO-09, TRACKING, SETUP (garde admin).
docs/01 › Backoffice et Statut ; docs/02 › Backoffice ; docs/07 ›
decision_thresholds, events ; mockups BO-01 à BO-04, BO-06.

## Personas

Admin de démo ; un inscrit `role=user` (créé via une sub-app) pour le refus.

## Préconditions

Base seedée à neuf (les badges dépendent des chiffres du seed), serveur
lancé. Noter les seuils par défaut avant l'étape 12.

## Étapes

1. `/admin`, `/admin/products/lettre-pro`, `/admin/settings` sans session → `/admin/login`. [SETUP › 4 · BO-01 › 3]
2. `/admin/login` : champs vides, rien de prérempli dans le DOM ; mauvais mot de passe → « Identifiants invalides ». [BO-01 › 1-2 · mockup BO-01]
3. Inscrit `role=user` → même message « Identifiants invalides ». [BO-01 › 3]
4. Admin → `/admin`. Sidebar : Portefeuille, Thèmes, Réglages ; la déconnexion ramène sur `/admin/login`, et `/admin` redemande la connexion. [BO-01 › 4 · CONTRACT-ui › 1]
5. Portefeuille : KPIs 30 j (revenu, marge, coût IA, visites), tableau des 3 produits, badges LettrePro « à scaler », NomDeMarque « à couper », DescriPro aucun. Les chiffres sont cohérents entre KPIs et somme des lignes. [BO-02 › 1, 5 · mockup BO-02]
6. Tri : cliquer chaque en-tête (statut, visites, conversion, revenu, coût IA, marge) inverse l'ordre. [BO-02 › 2]
7. Fiche `/admin/products/nom-de-marque` : funnel en 5 étapes (visite → 1re génération → inscription → crédits épuisés → achat) avec volumes et taux ; KPIs revenu, ARPU, coût IA, « Marge / génération » ; courbes 30 j ; statut Test ; encart de décision « à couper » avec « Ce que disent les chiffres » ; lien vers `/nom-de-marque`. [BO-03 › 1-3 · mockup BO-03]
8. Navigation portefeuille → fiche : nom et statut immédiats, chiffres ensuite (squelette `product-sheet-skeleton`). [docs/04 › instant() 2 · BO-03]
9. Fiche d'un produit sans données (en créer un minimal, ou `NON TESTÉ` si impossible sans BO-05) → état « sans données », pas d'erreur. [BO-03 › 4]
10. `/admin/products/lettre-pro/activity` : générations (entrée, sortie, modèle, coût), achats, mouvements de crédits dont les remboursements ; pagination (page suivante et retour). [BO-04 · mockup BO-04]
11. « Changer de statut » sur DescriPro : actuel → nouveau, chiffres qui justifient, « Note de décision » ; Learn → Scale enregistré, badge mis à jour dans le portefeuille ; puis retour à Learn. [BO-06 › 1, 3 · mockup BO-06]
12. `/admin/settings` : « Seuils par défaut du studio » (Visites minimales, Conversion « à couper » (%), Conversion « à scaler » (%), « Marge positive exigée pour scaler ») ; valeurs du seed 1000 / 2 / 5 / cochée. [BO-09 › 1 · docs/07 › decision_thresholds]
13. « à couper » 6 et « à scaler » 5 → erreur de validation, rien d'enregistré (réseau : pas de 200 qui écrit). [BO-09 › 3]
14. « à scaler » 50 → « Badges qui changeraient : » annonce LettrePro ; enregistrer → `/admin` n'affiche plus « à scaler » sur LettrePro à la requête suivante. Restaurer 5. [BO-09 › 4-5]
15. « Surcharge par produit » : « Produit à surcharger » NomDeMarque, « Conversion « à couper » (%) (produit) » 0,5 → aperçu, « Enregistrer la surcharge » → badge retiré ; « Réinitialiser » → surcharge supprimée, badge revenu. [BO-09 › 2]
16. Après chaque étape : `get_errors` vide, aucune erreur console, aucun 5xx.

## Nettoyage

Seuils par défaut et statut de DescriPro restaurés (étapes 11 et 14), surcharge
supprimée (15). Produit minimal de l'étape 9 : laissé, signalé dans le rapport
(la remise à zéro de `demo-ops.md` l'efface).
