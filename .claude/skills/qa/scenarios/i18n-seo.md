# Scénario i18n-seo · Anglais et référencement

## Objectif

Vérifier qu'un produit `locale=en` est entièrement en anglais sans segment de
langue dans l'URL, que le backoffice reste en français, et que chaque produit
a son SEO généré depuis sa config : metadata, image OG, icône, sitemap, robots.
À lancer après I18N-SEO, SA-01 ou tout ajout de clés dans `messages/`.

## Specs et docs couvertes

I18N-SEO, SA-01 › 4 (generateMetadata), SA-08, CONTRACT-ui (next-intl).
docs/01 › Langues ; docs/04 › SEO par produit ; docs/08 › i18n ; docs/09 ›
messages par zone.

## Personas

Visiteur anonyme puis inscrit jetable sur le produit anglais ; admin de démo
pour créer ce produit si besoin.

## Préconditions

Base seedée, serveur lancé. Un produit `locale=en` publié : BioInsta
(`creation-produit.md`). S'il n'existe pas, le créer d'abord (étapes 1 à 12 de
`creation-produit.md`) ; si c'est impossible, marquer les étapes 2 à 6 `NON TESTÉ`.

## Étapes

1. Clés : `messages/en/*.json` a exactement les clés de `messages/fr/*.json` (comparaison par script `node` dans le scratchpad), et le test `i18n/messages.test.ts` existe. [I18N-SEO › 1]
2. `/bio-instagram` : `<html lang="en">`, landing et textes communs en anglais (« Try it free », « Get started », header « Sign in ») ; aucun texte français visible. [I18N-SEO › 1 · docs/01 › Langues]
3. `/bio-instagram/tool` → génération gratuite → modale d'inscription en anglais → « Sign me in » → paywall « Buy » → paiement « Pay … (simulated) » → confirmation « Resume my generation → ». Erreurs de validation en anglais aussi. [I18N-SEO › 1 · docs/08 › i18n « erreurs d'action »]
4. `/bio-instagram/history`, `/bio-instagram/account`, `/bio-instagram/page-inconnue` : en anglais. [I18N-SEO › 1]
5. Les montants suivent la langue (format `€4.90` en en, `4,90 €` en fr) ou, à défaut, sont cohérents ; noter ce qui est rendu. [docs/08 › i18n]
6. Le backoffice reste en français quand on ouvre la fiche de BioInsta. [docs/01 › Langues]
7. `/lettre-pro` (fr) : `<html lang="fr">`, textes en français. [I18N-SEO › 1]
8. Metadata : `curl -s /lettre-pro` → `<title>` et `<meta name="description">` = seoTitle / seoDescription de la config, `<link rel="canonical" href=".../lettre-pro">`, balises Open Graph ; `themeColor` = couleur du thème. [SA-01 › 4 · docs/04 › SEO par produit]
9. `/lettre-pro/opengraph-image` → PNG 1200 × 630 aux couleurs d'Editorial ; `/bio-instagram/opengraph-image` aux couleurs de Neon ; `/lettre-pro/icon` → favicon généré (initiale ou logo sur la couleur du thème). Les enregistrer dans le scratchpad et les regarder. [I18N-SEO › 2 · docs/04 › opengraph-image, icon]
10. `/sitemap.xml` : les landings de tous les produits non killed, URL absolues sur la base de `BETTER_AUTH_URL` ; un produit passé en killed en disparaît (si `backoffice-pilotage.md` ou `full.md` l'a fait). [I18N-SEO › 3]
11. `/robots.txt` : `Allow: /`, `Disallow` sur `/admin`, lien vers le sitemap. [I18N-SEO › 3 · docs/04]
12. Landing statique : le HTML initial contient hero, titre et CTA ; seul le bouton de compte du header est en attente (`agent-browser react suspense --only-dynamic`). [SA-01 › 3 · docs/04 › Trois points à ne pas rater 1]

## Nettoyage

Rien à restaurer.
