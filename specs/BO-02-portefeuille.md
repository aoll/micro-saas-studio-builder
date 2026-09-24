# BO-02 · Portefeuille
Réf         : Écrans › BO-02 · Produit › Statut Test → Learn → Scale → Killed
              · Modèle de données › decision_thresholds · specs/mockups/BO-02.png
Contrat     : getThresholds (gelé) ; implémente getPortfolioMetrics(range) et
              evaluate(metrics, thresholds) dans lib/decision.ts
Dépend de   : TRACKING
Acceptation :
- KPIs globaux en tête (revenu, marge, coût IA, visites) sur 30 jours
- Tableau triable : statut, visites, conversion, revenu, coût IA, marge
- evaluate() (fonction pure, testée sans base), avec les seuils du produit :
  - moins de min_visits → aucun badge
  - conversion inscription → achat < kill_max_conversion → « à couper »
  - conversion ≥ scale_min_conversion et, si exigé, marge par génération > 0
    → « à scaler »
  - sinon → aucun badge
- Avec le seed : LettrePro « à scaler », NomDeMarque « à couper », DescriPro sans badge
- Chiffres calculés en SQL sur events, purchases, generations ; test sur un jeu
  d'events connu
- État vide et skeleton de chargement
Périmètre   : admin/page.tsx, admin/loading.tsx, admin/_components/portfolio/**,
              lib/dal/metrics.ts (getPortfolioMetrics), lib/decision.ts,
              lib/decision.test.ts, e2e/portfolio.spec.ts
