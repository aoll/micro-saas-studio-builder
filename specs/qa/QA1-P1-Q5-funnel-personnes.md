# QA1-P1-Q5 · Le funnel compte des personnes
Réf         : .claude/qa/reports/2026-09-25-full.md › Q5 (validé par l'humain le 2026-09-25) · specs/BO-03-fiche.md › Acceptation 1 · docs/02 › BO-03 ·
              docs/01 › Le funnel suivi par produit
Contrat     : getFunnel(productId, range) garde sa signature et son type de retour
Dépend de   : QA1-P1-B4-visite-double, QA1-P1-B5-premiere-generation
Acceptation :
- Chaque étape du funnel (visite → 1re génération → inscription → crédits épuisés →
  achat) compte des personnes distinctes (anonymous_id ou user_id reliés par
  TRACKING), pas des events : deux 402 ou deux achats d'une même personne comptent 1
- Les taux de passage se calculent sur ces personnes ; le plan dit comment une
  personne qui saute une étape est comptée, et aucun taux n'est affiché au-dessus de
  100 %
- Les KPIs revenu, ARPU, coût IA ne changent pas
Périmètre   : lib/dal/metrics.ts (implémentation), admin/products/[slug]/_components/**
              (affichage du funnel), leurs tests
Hors périmètre : B4, B5
