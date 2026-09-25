# QA1-P1-B5 · « 1re génération » une fois par visiteur
Réf         : .claude/qa/reports/2026-09-25-full.md › B5 (validé par l'humain le 2026-09-25) · docs/01 › Le funnel suivi par produit · specs/SA-02-outil.md
              › Acceptation 6 · specs/TRACKING.md › Acceptation 4
Contrat     : signatures DAL inchangées
Dépend de   : —
Acceptation :
- Un visiteur qui fait sa génération gratuite en anonyme, s'inscrit puis génère
  connecté ne produit qu'un seul event first_generation pour ce produit
- Un inscrit qui n'a jamais généré en anonyme produit son first_generation à sa
  première génération connectée
- Aucun changement pour les autres types d'events
Périmètre   : [app]/api/generate/route.ts, lib/dal/generations.ts et lib/dal/events.ts
              (implémentation seulement), leurs tests
Hors périmètre : B7 (refus 402), Q5
