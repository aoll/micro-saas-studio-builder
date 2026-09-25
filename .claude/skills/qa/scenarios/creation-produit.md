# Scénario creation-produit · Créer et publier BioInsta

## Objectif

Le moment clé de la démo (docs/01 › Pitch) : créer « Générateur de bio
Instagram » depuis le formulaire en 7 étapes, tester le prompt, publier, puis
ouvrir `/bio-instagram` déjà brandé, référencé et utilisable. À lancer après
BO-05a, BO-05b ou un changement de `lib/schemas/product-config`.

## Specs et docs couvertes

BO-05a, BO-05b, CONTRACT-types (validation de la config), SA-01, I18N-SEO
(produit anglais). docs/01 › Configuration d'un produit, Contenu des produits
seedés, Script de démo 2-3 ; docs/02 › BO-05 en détail ; docs/04 › Mutations,
updateTag ; docs/05 › Tester le prompt ; docs/07 › product_versions ; mockup BO-05.

## Personas

Admin de démo ; visiteur anonyme pour ouvrir la sub-app.

## Préconditions

Base seedée, serveur lancé, pas de produit `bio-instagram` en base. Source des
valeurs : `fixtures/bio-instagram.config.json`.

## Étapes

1. `/admin` → « Nouveau produit » → `/admin/products/new`. Étapes à gauche : Identité, Thème, Landing & SEO, Champs de l'outil, Génération, Pricing, Récapitulatif ; aperçu de la landing à droite. [docs/02 › BO-05 · mockup BO-05]
2. Identité : taper « BioInsta » → slug proposé `bioinsta`, modifiable en `bio-instagram` ; statut initial Test ; langue en. [BO-05a › 2]
3. Slug `lettre-pro` → erreur d'unicité à l'étape 1 ; slug `admin` ou `api` → refusé (réservé). « Suivant » ne passe pas l'étape en erreur. [BO-05a › 2, 6 · CONTRACT-types › 1 · docs/09 › pièges]
4. Thème : vignettes des 4 thèmes rendues avec leurs tokens ; Neon sélectionné, l'aperçu change ; couleur principale optionnelle (tester un contraste illisible si l'UI le contrôle) ; logo (upload Blob : en local sans vrai token, noter le comportement). [BO-05a › 3 · docs/01 › formulaire, Contrôle]
5. Landing & SEO : titre, sous-titre, FAQ éditable (ajouter, retirer), meta title et description avec compteur de caractères. [BO-05a › 4]
6. Champs de l'outil : `niche` (text), `highlights` (textarea), `tone` (select playful / professional) ; « monter / descendre » réordonne ; deux clés identiques → erreur à l'étape 4. [BO-05a › 5-6]
7. Génération : modèle, prompt système, template ; cliquer une variable l'insère ; ajouter `{{inconnu}}` → l'étape est bloquée avec un message ; retirer. [BO-05b › 1]
8. « Tester le prompt » → résultat (mock), tokens et coût ; le réseau montre la Server Action en 200 ; aucun crédit débité. [BO-05b › 2 · docs/05 › testPrompt]
9. Pricing : 3 crédits offerts, 1 génération anonyme, coût 1, packs 10 / 490 et 50 / 1490 recommandé ; marge estimée par génération affichée ; valeur négative refusée. [BO-05b › 3 · docs/01 › Contrôle « Valeurs positives »]
10. Revenir à l'étape 1 puis à l'étape 6 : rien n'est perdu. [docs/04 › `<Activity>`]
11. « Enregistrer » → brouillon : toast, `/bio-instagram` pas encore publié (vérifier ce que répond la route). [BO-05a › 7]
12. Récapitulatif : résumé, aperçu final, « Publier » → lien vers `/bio-instagram`. [BO-05b › 4]
13. `/bio-instagram` (390 × 844) : thème Neon, landing variante `split`, tout en anglais (« Try it free », FAQ de la config), `<title>` = « AI Instagram Bio Generator » dans le HTML initial. [docs/01 › Script 3 · SA-01 › 4 · I18N-SEO › 1]
14. Génération gratuite sur `/bio-instagram/tool` → résultat de la fixture BioInsta (3 bios en markdown). [docs/05 › Stratégie de mock]
15. Édition : `/admin/products/bio-instagram` → « Modifier la config » → changer le headline, publier → `/bio-instagram` montre le nouveau titre à la requête suivante (pas de cache périmé). [BO-05b › 4 · docs/04 › updateTag]
16. `/admin` : BioInsta dans le portefeuille, statut Test, sans badge (moins de 1 000 visites). [BO-02 › 3]

## Nettoyage

BioInsta reste en base (d'autres scénarios s'en servent). Pour l'effacer : la
remise à zéro de `demo-ops.md`, ou une base recréée
(`pnpm tsx scripts/worktree-db.ts drop` puis `ensure --seed`).
