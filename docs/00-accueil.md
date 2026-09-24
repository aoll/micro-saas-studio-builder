# Micro-SaaS Studio Builder — Démo Dotworld

Sep 24, 2026 · @Alex

[image: Micro-SaaS Studio Builder — candidature d'Alexandre Ollivier\]

Bonjour, je suis **Alexandre Ollivier**, développeur fullstack senior. En découvrant le modèle de Dotworld, j'ai voulu montrer plutôt que raconter : ce document présente une démo construite pour ma candidature, et la façon dont je l'ai pensée.

## En 30 secondes

**Un backoffice de SaaS studio qui lance un micro-SaaS IA en quelques minutes, puis le pilote par la donnée** jusqu'à la décision de le garder ou de le couper. Chaque produit est un outil IA avec crédits (générateur de lettres, de bios, de noms de marque…), créé depuis un formulaire, habillé d'un thème partagé, et servi sur sa propre URL.

|  |  |
| --- | --- |
| Vidéo (2 min) | \[lien à venir\] |
| Démo en ligne | \[lien à venir\] · identifiants admin dans mon message |
| Code | \[lien GitHub à venir\] |

[image: La démo en chiffres : 17 écrans, 4 thèmes, moins de 2 $ de coût IA, 14,5 jours de delivery agentique\]

## Pourquoi cette démo

Elle reprend votre métier en miniature :

- **Plusieurs SaaS sur un socle commun** : même stack, mêmes thèmes, même système de crédits ; un nouveau produit est une configuration, pas un projet.
- **Test → Learn → Scale** : chaque produit a son funnel, son coût IA, sa marge, et un statut qui aide à décider.
- **Votre stack et votre façon de travailler** : Next.js, TypeScript, Tailwind, shadcn, server actions ; développée avec Claude Code, specs et tests à l'appui.

[image: Test, Learn, Scale appliqués à chaque produit de la démo\]

**Comment le document a été construit** : comprendre votre modèle, poser le concept, dessiner les écrans, faire les choix techniques à partir de la documentation à jour, chiffrer, planifier. En simplifiant à chaque étape ce qui n'apportait rien à la démo : paiement et email simulés, pas de Redis, pas de glisser-déposer.

## Guide des onglets

| Onglet | Ce qu'il contient | À lire pour… |
| --- | --- | --- |
| Produit | Concept, parcours utilisateur, configuration d'un produit et thèmes, mécanique des crédits, backoffice, mode démo, architecture, script de démo | Comprendre ce qui est construit |
| Écrans | Les 17 écrans avec routes, contenu, états et priorité | Le périmètre fonctionnel |
| Maquettes | Une maquette par écran | Voir le rendu |
| Next.js | Routing, cache, mutations, SEO, rendu front, outillage agents, selon la doc Next.js 16.3 | Les choix de framework |
| IA | AI SDK et AI Gateway, sûreté des sorties, consommation de tokens, mock et seed | Tout ce qui touche au LLM |
| Modèle de données | Tables, invariants, index, extrait du ledger de crédits | Le schéma de la base |
| Vercel | Briques de la plateforme retenues ou écartées | L'hébergement |
| Stack | Librairies, scripts, services, variables d'environnement | Démarrer le projet |
| Arborescence | Organisation du repo, fichiers imposés par chaque librairie, règles d'import | S'orienter dans le code |
| Tooling dev | TypeScript strict, ESLint, hooks Git, template de PR, previews, outillage de l'agent | La qualité et la façon de livrer |
| Implémentation | Méthode SDD + TDD, roadmap en vagues, agents en parallèle, déploiement dès le jour 1 | Voir comment c'est construit |
| Specs | Les 28 specs minimales, prêtes pour les agents, et le brief de lancement | Le détail de chaque feature |
| Coûts | Coût par poste et paliers gratuits | Le budget (moins de 2 $) |

## Les décisions clés

| Sujet | Décision |
| --- | --- |
| Produit | Un seul type de produit : outil IA avec crédits, configuré par formulaire, servi sur `/{slug}` |
| Thèmes | 4 thèmes en base, choisis à la création, appliqués en variables CSS |
| Framework | Next.js 16.3.6 : Cache Components, root param `[app]`, modales en intercepting routes |
| IA | AI SDK 7 + AI Gateway, modèles Claude par défaut (Haiku), mock et fixtures en dev |
| Crédits | Ledger en insertion seule, solde avec `CHECK >= 0`, idempotence partout |
| Paiement | Simulé : une server action `purchase()` dans une modale |
| Email | Simulé : boîte de réception en modale, vrai lien magique |
| Infra | Vercel + Neon + AI Gateway, ni Redis ni service d'email |
| Langues | Langue par produit (fr / en) via next-intl, backoffice en français |
| Démo publique | Identifiants admin envoyés, produits seedés verrouillés, remise à zéro depuis une page cachée (cron nocturne en bonus) |
| Budget | Moins de 2 $ au total |
| Planning | Environ 14,5 jours, démo montrable en fin de semaine 1 |

## À propos de moi

- **Plus de 10 ans** de développement fullstack TypeScript.
- **Ancien VP Engineering chez Maiia** (Cegedim Santé) : 7 équipes, en France et offshore ; releases hebdomadaires ; implication dans le recrutement de 40 personnes.
- **Chez Trusk** : un EAI complet livré en production en 20 semaines à deux, 100 % du code produit par des agents et 100 % relu par un humain (specs + TDD) ; puis formation des équipes au développement agentique.
- **Formateur et consultant** en développement agentique (Atelier Agentic).

agollivier@gmail.com · [GitHub](https://github.com/aoll) · [LinkedIn](https://linkedin.com/in/alexandre-ollivier-64b925285)
