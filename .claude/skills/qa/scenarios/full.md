# Scénario full · Toute la plateforme

## Objectif

Rejouer le script de démo de bout en bout (docs/01 › Script de démo), puis
tout ce que le dossier promet autour : chaque écran BO et SA, l'anglais, le
SEO, la sécurité visible en local et la page cachée `/admin/ops`. C'est la
passe à lancer après un run complet.

## Specs et docs couvertes

Toutes les specs de `specs/` (SETUP et CONTRACT via leurs effets visibles).
docs/01 (parcours, crédits, backoffice, mode démo, script), docs/02 (écrans et
états), docs/03 et `specs/mockups/*.png`, docs/04 (routing, modales, SEO,
erreurs), docs/05 (mock), docs/06 (BotID), docs/07 (ledger, events), docs/08
(email simulé, rate limit, i18n).

## Personas

Admin de démo, visiteur anonyme puis inscrit (un compte jetable par
parcours), utilisateur `role=user` au BO, owner.

## Préconditions

- Base seedée à neuf (`worktree-db.ts ensure --seed` ou `pnpm db:seed`),
  serveur lancé, `DEMO_MODE=false`.
- Aucun produit `bio-instagram` en base (sinon, étape 3 : slug déjà pris).

## Étapes

### 1. Connexion admin (BO-01)

1.1 `/admin` sans session → redirection vers `/admin/login`. [SETUP › Acceptation 4]
1.2 Champs Email et Mot de passe vides à l'ouverture. [BO-01 › Acceptation 2 · mockup BO-01]
1.3 Mauvais mot de passe → « Identifiants invalides », sans dire lequel. [BO-01 › 1]
1.4 Compte admin du seed → `/admin`. Navigation : Portefeuille, Thèmes, Réglages, déconnexion. [CONTRACT-ui › 1]

### 2. Portefeuille (BO-02)

2.1 KPIs du studio sur 30 jours : revenu, marge, coût IA, visites. [BO-02 › 1 · mockup BO-02]
2.2 Tableau : statut, visites, conversion, revenu, coût IA, marge ; tri par colonne. [BO-02 › 2]
2.3 Badges du seed : LettrePro « à scaler », NomDeMarque « à couper », DescriPro sans badge. [BO-02 › 5 · docs/01 › Script 1]
2.4 Squelette de chargement visible au premier rendu (`admin/loading.tsx`). [BO-02 › 7]

### 3. Création en direct de BioInsta (BO-05a, BO-05b)

3.1 « Nouveau produit » → `/admin/products/new`, 7 étapes : Identité, Thème, Landing & SEO, Champs de l'outil, Génération, Pricing, Récapitulatif. [docs/02 › BO-05 · mockup BO-05]
3.2 Saisir la config de `fixtures/bio-instagram.config.json` (nom BioInsta, slug `bio-instagram`, statut test, langue en, thème Neon, landing, 3 champs, prompt, packs). Le dossier parle d'une config « prête à coller » : note s'il existe un import ; un remplissage champ par champ n'est pas un BUG. [docs/01 › Contenu des produits seedés]
3.3 Slug dérivé du nom et modifiable ; un slug pris (`lettre-pro`) ou réservé (`admin`) est refusé à l'étape 1. [BO-05a › 2 · CONTRACT-types › 1]
3.4 Étape 2 : vignettes des thèmes, aperçu de la landing qui suit la saisie. [BO-05a › 3 · BO-05b › 5]
3.5 Étape 3 : compteur de caractères sur meta title et description. [BO-05a › 4]
3.6 Étape 4 : monter / descendre un champ ; deux clés identiques → erreur à l'étape 4. [BO-05a › 5-6]
3.7 Étape 5 : variables `{{niche}}` `{{highlights}}` `{{tone}}` cliquables ; une `{{x}}` sans champ bloque l'étape ; « Tester le prompt » → résultat, tokens, coût. [BO-05b › 1-2]
3.8 Étape 6 : marge estimée par génération affichée. [BO-05b › 3]
3.9 « Enregistrer » → brouillon (nouvelle version, non publiée) ; « Publier » → lien vers `/bio-instagram`. [BO-05a › 7 · BO-05b › 4]

### 4. Sub-app BioInsta, en anglais, mobile (SA-01, SA-02, I18N-SEO)

4.1 `/bio-instagram` (390 × 844) : thème Neon, hero, exemple, « how it works », tarifs, FAQ, tout en anglais (textes communs compris). [SA-01 › 1 · I18N-SEO › 1 · docs/01 › Script 3]
4.2 `<title>` et description = seoTitle / seoDescription de la config, dans le HTML initial (`curl`). [SA-01 › 4]
4.3 CTA → `/bio-instagram/tool` : formulaire des 3 champs, bouton de génération avec son coût, solde dans le header. [SA-02 › 1 · mockup SA-02]
4.4 Champ requis vide → message d'erreur sous le champ, pas d'appel réseau. [SA-02 › 1]

### 5. Funnel utilisateur (SA-02 → SA-07), visiteur puis inscrit

5.1 Anonyme : génération gratuite streamée (`POST /bio-instagram/api/generate` en 200), carte de résultat : copier, télécharger, régénérer. [SA-02 › 2, 7]
5.2 Dès la fin du flux gratuit, la modale d'inscription s'ouvre sur l'outil (URL `/bio-instagram/signup`) ; une nouvelle tentative anonyme répond 401 `signup_required` et rouvre la modale. [SA-02 › 4 · SA-03 › 1]
5.3 Email jetable → boîte de réception simulée aux couleurs du produit → « Sign me in » (`messages/en/auth.json`) → retour sur l'outil, solde 3. [SA-03 › 2-3 · docs/08 › Email simulé]
5.4 Générer jusqu'à 0 crédit : chaque génération -1 (badge animé) ; à 0, la génération répond 402 et la modale tarifs s'ouvre. [SA-02 › 5 · SA-04 › 2 · docs/01 › Script 4]
5.5 Pack recommandé mis en avant, prix par génération ; « Buy » → modale de paiement « Pay … (simulated) » (URL `/bio-instagram/checkout/pack-50`). [SA-04 · mockup SA-04]
5.6 Récapitulatif, carte de test préremplie, mention paiement simulé ; payer → état en cours → confirmation, nouveau solde, CTA qui ferme la modale ; retour à l'outil sans rechargement. [SA-05 › 1-3 · mockups SA-05, SA-05-confirmation]
5.7 Double clic sur Payer → un seul crédit (solde +50, pas +100). [SA-05 › 4]
5.8 `/bio-instagram/checkout/pack-10` rechargé en direct → page complète, pas une modale. [SA-05 › 1 · docs/04 › Routing]
5.9 `/bio-instagram/history` : générations de cet utilisateur, plus récente d'abord, rouvrir, copier. [SA-06 › 1-2]
5.10 `/bio-instagram/account` : solde, mouvements (bonus, achat, générations), achats, déconnexion. [SA-07 · mockup SA-07]
5.11 Même parcours en fr, desktop, sur `/lettre-pro` jusqu'au paiement (autre compte, autre IP) : textes en français, thème Editorial. [I18N-SEO › 1 · docs/02 › Sub-app]

### 6. Retour au backoffice (BO-02, BO-03, BO-04)

6.1 Portefeuille : BioInsta présent, Test, visites, revenu et coût IA non nuls. [E2E-demo › 1 · docs/01 › Script 6]
6.2 Fiche `/admin/products/bio-instagram` : funnel en 5 étapes avec volumes et taux, KPIs (revenu, ARPU, coût IA, marge / génération), courbes 30 j, seuils, lien vers `/bio-instagram`. [BO-03 · mockup BO-03]
6.3 Fiche LettrePro : encart de décision « à scaler » et ses chiffres. [BO-03 › 3]
6.4 Activité `/admin/products/bio-instagram/activity` : générations (entrée, sortie, modèle, coût), achats, mouvements, pagination ; état vide sur un produit sans usage. [BO-04 · mockup BO-04]

### 7. Statut (BO-06, SA-08)

7.1 « Changer de statut » sur BioInsta : actuel → nouveau, chiffres, « Note de décision ». [BO-06 › 1 · mockup BO-06]
7.2 Killed avec confirmation explicite → `/bio-instagram` répond 404, écran SA-08 avec « Nos autres outils » sans BioInsta ; absent du sitemap. [BO-06 › 2 · SA-08 · I18N-SEO › 3]
7.3 `/produit-inconnu` → 404 SA-08. [SA-08 › 1 · mockup SA-08]

### 8. Thèmes (BO-07, BO-08)

8.1 `/admin/themes` : 4 vignettes, nombre de produits par thème. [BO-07 · mockup BO-07]
8.2 Éditer Editorial : avertissement « utilisé par N produits » ; changer la couleur primary, enregistrer → `/lettre-pro` suit à la requête suivante. Restaurer la valeur. [BO-08 · docs/04 › updateTag]

### 9. Seuils (BO-09)

9.1 `/admin/settings` : visites minimales, conversion « à couper » et « à scaler » en %, marge positive exigée. [BO-09 › 1]
9.2 « à couper » ≥ « à scaler » → erreur de validation. [BO-09 › 3]
9.3 Modifier un seuil : aperçu « Badges qui changeraient : » avant d'enregistrer ; après, BO-02 suit. Restaurer (1 000, 2 %, 5 %, marge exigée). [BO-09 › 4-5]
9.4 Surcharge produit : « Enregistrer la surcharge » puis « Réinitialiser » la retire. [BO-09 › 2]

### 10. SEO et sécurité visible en local (I18N-SEO, SECURITY)

10.1 `/sitemap.xml` liste les landings non killed ; `/robots.txt` interdit `/admin`. [I18N-SEO › 3]
10.2 `/lettre-pro/opengraph-image` et `/lettre-pro/icon` : images aux couleurs du thème. [I18N-SEO › 2]
10.3 Rate limit : un inscrit avec des crédits enchaîne plus de `GENERATION_RATE_LIMIT_PER_MINUTE` générations en 60 s → 429 et message « Trop de générations… ». [SECURITY › 2 · docs/08 › Rate limit]
10.4 BotID contourné hors Vercel (`VERCEL` non posée) : aucune génération, inscription ou achat refusé en 403 `bot` pendant la passe. [docs/06 › BotID]

### 11. Accès et page cachée (BO-01, DEMO-mode)

11.1 Inscrit `role=user` sur `/admin/login` → « Identifiants invalides ». [BO-01 › 3]
11.2 Admin sur `/admin/ops` → 404. Owner → « Opérations », bouton « Réinitialiser la démo ». Aucun lien vers `/admin/ops` dans la navigation. [DEMO-mode › 2 · docs/01 › Mode démo]
11.3 (Optionnel, dernier) « Réinitialiser la démo » → « Confirmer la réinitialisation » → BioInsta et les comptes jetables disparaissent, le portefeuille revient à l'histoire du seed. [DEMO-mode › 2]

## Nettoyage

Thème Editorial et seuils restaurés aux étapes 8 et 9. Si 11.3 n'a pas été
jouée : `pnpm db:seed` ne supprime pas BioInsta ; relancer
`worktree-db.ts ensure --seed` n'y suffit pas non plus : la remise à zéro
(11.3) ou une base recréée (`worktree-db.ts drop` puis `ensure --seed`) le fait.
