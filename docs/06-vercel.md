# Vercel dans la démo

Hébergement et briques de plateforme, hors IA (l'AI SDK et l'AI Gateway sont dans l'onglet IA). **Deux briques valent le coup dès la v1 (BotID, Blob), une est un très bon bonus (Flags SDK)**, le reste n'apporte rien à cette démo.

## Les briques et leur intérêt

| Brique | Intérêt pour la démo | Verdict |
| --- | --- | --- |
| **BotID** | CAPTCHA invisible vérifié côté serveur par `checkBotId()`. Protège `api/generate`, l'inscription et l'achat : un bot sur une URL publique brûle des crédits IA réels. Niveau **Basic gratuit** sur tous les plans ; l'analyse approfondie (Kasada) est facturée à l'appel sur Pro. | v1 |
| **Blob** | Stockage des logos chargés au formulaire BO-05, servis via `next/image` | v1 |
| **Flags SDK** | Bibliothèque open source (fonctionne hors Vercel) : flags déclarés en code avec `flag()` et `decide`, précalculables pour les pages statiques. Permet un **A/B test du titre de la landing** sans perdre le shell statique, soit exactement la phase « Learn » de Dotworld. | Bonus fort |
| **Web Analytics + Speed Insights** | Visites et Core Web Vitals des landings sans code ; `track()` côté serveur pour des events. Fait doublon avec la table `events`, qui reste la source du funnel. | Bonus |
| **Cron Jobs** | Remise à zéro automatique chaque nuit. En v1, le bouton de `/admin/ops` suffit ; le cron rejouerait le même script. Plus tard : agrégation des métriques et évaluation des seuils « à couper » | Bonus |
| **Workflows** (Workflow SDK, `'use workflow'` / `'use step'`) | Exécution durable avec reprise, pour des générations longues (vidéo, lots d'images) | Non : une génération de la démo tient dans une requête |
| **Sandbox**, **Queues** | Exécution de code isolée, files de messages | Non |

**L'A/B test comme moment de démo** : dans la fiche produit, un encart « Expérience en cours » compare deux titres de landing (conversion visite → première génération). C'est la suite logique du statut Test / Learn / Scale, et un argument produit plus que technique. À garder pour une v2 si le temps manque.

## Ce qu'on retient

**Dans la v1**

- [ ] Déploiement sur Vercel, avec une URL publique
- [ ] BotID (Basic) sur la génération, l'inscription et l'achat
- [ ] Blob pour les logos

**Bonus, dans l'ordre**

1. A/B test du titre de landing avec le Flags SDK
2. Web Analytics et Speed Insights sur les landings
3. Crons : remise à zéro nocturne de la démo (même script que le bouton de /admin/ops), puis agrégation des métriques

**Hors périmètre** : Workflows, Sandbox, Queues.

## Vercel ou Fly.io ?

**Vercel est le choix le plus simple pour cette démo.** Sur Fly.io (Docker), l'AI SDK, l'AI Gateway (avec clé d'API) et le Flags SDK fonctionnent tels quels, mais BotID, Blob, Analytics et Cron sont liés à la plateforme Vercel et devraient être remplacés par d'autres outils.

## Sources

Consultées le 23 septembre 2026.

- [BotID](https://vercel.com/docs/botid) · [Flags SDK](https://flags-sdk.dev/) · [Web Analytics custom events](https://vercel.com/docs/analytics/custom-events) · [Workflows](https://vercel.com/docs/workflow)
