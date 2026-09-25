# QA1-P1-B3 · Paiement ouvert depuis /pricing : la confirmation reste
Réf         : .claude/qa/reports/2026-09-25-full.md › B3 (validé par l'humain le 2026-09-25) · specs/SA-05-paiement.md › Acceptation 1, 3 · docs/02 › SA-05
Contrat     : purchase() inchangée
Dépend de   : —
Acceptation :
- Inscrit sur la page /{slug}/pricing, « Acheter » → modale checkout → « Payer …
  (simulé) » : la confirmation (+N crédits, nouveau solde, « Reprendre ») reste
  affichée ; aucune navigation pleine page vers /checkout/[packId] ; le CTA ferme la
  modale et revient à /pricing sans rechargement
- Le même paiement depuis le paywall de l'outil garde son comportement actuel
- Après la confirmation, aucun formulaire de paiement ne réapparaît, donc aucun
  second paiement possible par remontage (une seule ligne purchases)
Périmètre   : [app]/checkout/_actions.ts, [app]/checkout/_components/**,
              [app]/@modal/(.)checkout/**, [app]/checkout/[packId]/page.tsx,
              [app]/pricing/_components/**, leurs tests, e2e/checkout*.spec.ts
Hors périmètre : B14 (erreur Cache Components de checkout/[packId]/page.tsx)
