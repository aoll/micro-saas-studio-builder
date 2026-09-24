# BO-03 · Fiche produit
Réf         : Écrans › BO-03 · Produit › Le funnel suivi par produit
              · specs/mockups/BO-03.png
Contrat     : implémente getFunnel(productId, range) ; utilise getThresholds et evaluate()
Dépend de   : BO-02
Acceptation :
- Funnel en 5 étapes (visite → 1re génération → inscription → crédits épuisés →
  achat) avec volumes et taux de passage
- KPIs : revenu, ARPU, coût IA, marge par génération ; courbes 30 jours (Recharts)
- Statut, seuils de décision, statut suggéré ; lien vers /{slug}
- États : produit sans données, produit killed
Périmètre   : admin/products/[slug]/page.tsx, admin/products/[slug]/_components/**,
              lib/dal/metrics.ts (getFunnel), e2e/product.spec.ts
