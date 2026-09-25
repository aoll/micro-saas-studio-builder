# Scénario sous-app-funnel · Le parcours utilisateur d'une sub-app

## Objectif

Prouver que le parcours de docs/01 › Parcours utilisateur marche sur un
produit seedé, sans le backoffice : landing, génération gratuite, inscription,
crédits, paywall, paiement simulé, historique, compte, et les états d'erreur
de SA-02. À lancer après toute spec SA-xx, LEDGER ou TRACKING.

## Specs et docs couvertes

SA-01 à SA-08, LEDGER (effets visibles), TRACKING (events vus depuis BO-03).
docs/01 › Parcours utilisateur, Mécanique des crédits ; docs/02 › Sub-app et
Éléments transverses ; docs/04 › modales en intercepting routes, Erreurs ;
mockups SA-01 à SA-08, SA-05-confirmation.

## Personas

Visiteur anonyme (IP simulée `10.0.1.1`), puis inscrit jetable. Un second
visiteur (`10.0.1.2`) pour l'isolation de l'historique.

## Préconditions

Base seedée, serveur lancé. Produit : `/descri-pro` (Corporate, fr) par
défaut ; `/lettre-pro` (Editorial) ou `/nom-de-marque` (Playful) pour varier
les thèmes. Largeur 390 × 844 sauf mention.

## Étapes

1. `/descri-pro` : hero, CTA « Essayer gratuitement », « 1re génération offerte · sans inscription », « Exemple de résultat », « Comment ça marche », « Tarifs », « Questions fréquentes » ; mise en page `minimal` du thème Corporate. [SA-01 › 1-2 · mockup SA-01]
2. Le header affiche « Connexion » (pas de solde) ; aucun bandeau « Démo » (`DEMO_MODE=false`). [docs/02 › Header produit · CONTRACT-ui › 4]
3. Une visite est enregistrée : `POST /descri-pro/api/events` (sendBeacon) en 2xx, cookie `anonymous_id` posé. [TRACKING › 1-2]
4. « Essayer gratuitement » → `/descri-pro/tool` : 4 champs générés depuis la config (Nom du produit, Caractéristiques clés, Public cible, Ton), « Coûte 1 crédit par génération », bouton « Générer · 1 crédit ». [SA-02 › 1 · mockup SA-02]
5. Soumettre vide → « Ce champ est obligatoire. » sous chaque champ requis, aucun POST. [SA-02 › 1]
6. Génération gratuite : réponse 200 streamée (le texte apparaît progressivement, `aria-live`), carte de résultat « Copier », « Télécharger », « Régénérer ». [SA-02 › 2, 7 · docs/04 › Accessibilité]
7. Fin du flux → modale d'inscription par-dessus l'outil, URL `/descri-pro/signup`, « Vous avez aimé ? » + « 3 crédits offerts ». Échap ou « Fermer » la ferme, le bouton précédent aussi. [SA-03 › 1 · mockup SA-03 · docs/04 › Routing]
8. Recharger `/descri-pro/signup` → page complète, pas de modale. [SA-03 › 1]
9. Email invalide → « Adresse email invalide ». Email jetable → « Recevoir mon lien de connexion » → « Boîte de réception (démo) », email aux couleurs du produit, « Me connecter » → retour sur l'outil, solde « 3 crédits ». [SA-03 › 2-3 · docs/08 › Email simulé]
10. Rouvrir le même lien magique (copié à l'étape 9) → « Lien expiré » et « Recevoir un nouveau lien ». [SA-03 › 4]
11. Trois générations : le badge passe à 2, 1, 0 dès le clic (optimiste) et reste juste après chaque réponse. [SA-02 › 2 · docs/04 › useOptimistic]
12. Quatrième génération → 402 `insufficient_balance`, modale tarifs `/descri-pro/pricing` sur l'outil : « Plus de crédits ? Rechargez. », pack 50 « Recommandé », prix par génération. [SA-02 › 5 · SA-04 › 1-2 · mockup SA-04]
13. « Acheter » sur le pack 10 → modale « Paiement » : récapitulatif, carte 4242…, « Paiement simulé pour la démo · aucun montant n'est débité », « Payer 4,90 € (simulé) ». Plein écran à 390 px. [SA-05 › 1-2 · mockup SA-05]
14. Payer → « Paiement en cours… » → « Paiement confirmé », « +10 crédits », « Nouveau solde » 10, header à 10 sans rechargement ; « Reprendre ma génération → » ferme la modale sur l'outil. [SA-05 › 3 · mockup SA-05-confirmation]
15. Rejouer l'achat avec la même clé (double clic sur « Payer », ou renvoyer la requête capturée) → solde +10 une seule fois. [SA-05 › 4 · LEDGER › purchase]
16. `/descri-pro/pricing` en accès direct → page complète ; `/descri-pro/checkout/pack-50` en accès direct → page complète ; `/descri-pro/checkout/pack-inconnu` → « Ce pack n'existe plus » ou 404. [SA-04 › 1 · SA-05 › 1]
17. `/descri-pro/history` : 4 générations, plus récente d'abord (date, entrées résumées, début du résultat), « Ouvrir » affiche le résultat complet, « Copier ». Squelette « Chargement de l'historique… » au premier rendu. [SA-06 › 1-3 · mockup SA-06]
18. Second visiteur (`10.0.1.2`, nouveau contexte) sur `/descri-pro/history` → état vide « Aucune génération pour le moment » + « Aller à l'outil » ; aucune génération du premier. [SA-06 › 3-4]
19. Premier utilisateur, `/descri-pro/account` : « Mon compte », solde, « Mouvements de crédits » (Bonus d'inscription +3, Génération -1 ×3, Achat pack 10 crédits +10), « Achats », « Se déconnecter » → déconnecté. [SA-07 · mockup SA-07]
20. Non connecté sur `/descri-pro/account` → « Créez un compte pour voir vos crédits » / modale d'inscription. [SA-07 › 2]
21. Crédits par produit : le même utilisateur, connecté, sur `/lettre-pro/tool` a un solde de 0 (pas 10). [docs/07 › Vue d'ensemble]
22. Erreur IA : si le mock sait échouer (chercher dans `lib/ai/model.ts` et `fixtures/` un déclencheur d'échec), une génération qui échoue affiche « La génération a échoué. Votre crédit a été remboursé. » et le solde revient ; sinon `NON TESTÉ` avec la raison. [SA-02 › 3 · mockup SA-02]
23. `/produit-inconnu` → 404, « Ce produit n'est plus disponible », « Nos autres outils » avec les 3 produits seedés ; `/descri-pro/page-inconnue` → « Page introuvable », « Retour à DescriPro ». [SA-08 · mockup SA-08]
24. Clair / sombre (`prefers-color-scheme`) sur la landing et l'outil : contrastes lisibles, pas de flash. [docs/02 › Sub-app · docs/04 › Thèmes]

## Nettoyage

Rien à restaurer (usage des comptes jetables seulement). La remise à zéro
n'est pas prévue ici.
