# QA1-P1-B14 · Plus d'erreur Cache Components sur l'outil et le paiement
Réf         : .claude/qa/reports/2026-09-25-full.md › B14 (validé par l'humain le 2026-09-25) · docs/04 › Rendu et cache · specs/SA-02-outil.md
Contrat     : getSession() garde sa signature
Dépend de   : QA1-P1-B3-paiement-pricing
Acceptation :
- /{slug}/tool connecté, /{slug}/checkout/[packId] en page et en modale : aucune
  erreur « unstable value new Date() » ni « URL data outside of <Suspense> » en
  console, dans get_errors ni dans le journal du serveur
- Le shell reste statique (docs/04) : les données de session restent sous
  <Suspense>, jamais mises en cache
Périmètre   : lib/dal/session.ts (implémentation), components/product/header-balance.tsx,
              [app]/checkout/[packId]/page.tsx, [app]/tool/page.tsx, leurs tests
Hors périmètre : B3
