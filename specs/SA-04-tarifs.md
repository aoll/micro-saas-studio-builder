# SA-04 · Tarifs et paywall
Réf         : Écrans › SA-04 · Produit › Parcours utilisateur · specs/mockups/SA-04.png
Contrat     : getProduct (config.pricing.packs)
Acceptation :
- /pricing liste les packs de la config : crédits, prix, prix par génération,
  pack recommandé mis en avant
- Même contenu en modale sur l'outil quand le solde est à 0 (intercepting route
  @modal/(.)pricing, même composant que la page)
- Acheter → /checkout/[packId] (modale de paiement, SA-05)
Périmètre   : [app]/pricing/** (dont _components/), [app]/@modal/(.)pricing/**,
              messages/*/pricing.json, e2e/pricing.spec.ts
