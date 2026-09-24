# Coûts de la démo

Tarifs relevés le Sep 24, 2026.

## Coût par poste

**Moins de 2 $ au total**, soit uniquement les tokens IA. L'hébergement et la base tiennent dans les paliers gratuits.

| Poste | Offre | Limites incluses | Besoin de la démo | Coût |
| --- | --- | --- | --- | --- |
| Hébergement | Vercel Hobby | 1 M d'invocations de fonctions, 4 h de CPU actif, 100 Go de transfert par mois | Quelques milliers de requêtes | 0 $ |
| Stockage des logos | Vercel Blob (inclus Hobby) | 1 Go | Quelques Mo | 0 $ |
| Protection anti-bots | BotID Basic | Gratuit sur tous les plans | — | 0 $ |
| Base de données | Neon Free | 0,5 Go de stockage, 100 CU-heures par mois, mise en veille après 5 min | Quelques dizaines de Mo, quelques heures de calcul | 0 $ |
| Appels LLM | AI Gateway, sans marge sur les tokens | Palier gratuit avec crédits mensuels ; budget plafonnable | \~1 000 générations en Haiku, dont la moitié évitée par le mock | < 2 $ |
| Domaine personnalisé | Optionnel | — | Un sous-domaine `*.vercel.app` suffit | 0 $ (ou \~10 à 15 €/an) |
| **Total** |  |  |  | **< 2 $** |

**Si l'on dépasse les paliers gratuits**

| Poste | Offre payante | Prix |
| --- | --- | --- |
| Vercel | Pro | 20 $ par mois, avec 20 $ de crédit d'usage inclus |
| Neon | Launch, à l'usage, sans minimum | 0,106 $ par CU-heure, 0,35 $ par Go-mois |
| Tokens IA | Prix du fournisseur, via le Gateway | Haiku 4.5 : 1 $ / 5 $ par million de tokens (entrée / sortie) ; Sonnet 5 : 2 $ / 10 $ |

**Hors périmètre** : le développement avec Claude Code, qui passe par ton abonnement ou ta clé Claude Code et représente des dizaines de millions de tokens. Et les services retirés de la v1 (Redis, email, Stripe), qui auraient été gratuits eux aussi à ce volume.

## Points d'attention

- **Vercel Hobby est réservé à un usage personnel et non commercial.** Une démo de candidature sans vrai paiement rentre a priori dans ce cadre. Si le doute persiste, ou si la démo sert ensuite à démarcher des clients, il faut passer sur Pro (20 $ par mois).
- **Mise en veille de Neon** : après 5 minutes sans requête, la première requête est plus lente, le temps que la base se réveille. Avant un entretien, ouvrir le portefeuille une minute avant de partager l'écran.
- **Le seul dépassement possible, ce sont les tokens IA** (un bot, un lien partagé largement). Le budget plafonné de l'AI Gateway, BotID, le rate limit et les crédits le bornent.
- **Produits à sortie image** : non chiffrés ici ; nettement plus chers que le texte par génération, à vérifier avant d'en ajouter un.

**Sources** : [tarifs Vercel](https://vercel.com/pricing) · [tarifs Neon](https://neon.com/pricing) · [tarifs AI Gateway](https://vercel.com/docs/ai-gateway/pricing) · [tarifs Claude](https://platform.claude.com/docs/en/about-claude/pricing) · [BotID](https://vercel.com/docs/botid)
