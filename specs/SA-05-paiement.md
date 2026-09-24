# SA-05 · Paiement simulé
Réf         : Écrans › SA-05 · Produit › Paiement : une seule fonction purchase
              · specs/mockups/SA-05.png
Contrat     : purchase(packId, idempotencyKey) → { balance }, guardRequest
Dépend de   : LEDGER, SA-04
Acceptation :
- Modale sur l'outil et sur /pricing, plein écran sur mobile ; /checkout/[packId]
  en accès direct → page complète
- Récapitulatif du pack, carte de test préremplie, mention « paiement simulé »
- Payer → guardRequest('purchase') → état en cours → confirmation avec le nouveau solde (badge du header mis
  à jour par useOptimistic), CTA « Reprendre » qui ferme la modale
- Double clic ou rejeu → un seul crédit ; event purchase avec le pack en metadata
Périmètre   : [app]/checkout/** (dont _actions.ts et _components/),
              [app]/@modal/(.)checkout/**, messages/*/checkout.json,
              e2e/checkout.spec.ts
Hors périmètre : Stripe
