# QA1-P1-Q2 · Première venue connectée sur un autre produit : bonus et inscription
Réf         : .claude/qa/reports/2026-09-25-full.md › Q2 (validé par l'humain le 2026-09-25, lecture 1) · docs/01 › Mécanique des crédits · docs/07 ›
              Vue d'ensemble (crédits par utilisateur et par produit), events
Contrat     : signatures DAL et ledger inchangés ; si une nouvelle fonction DAL ou un
              changement de signature est nécessaire, s'arrêter et le signaler
              (contrat gelé)
Dépend de   : QA1-P1-L1-lot-leger, QA1-P1-B4-visite-double
Acceptation :
- Un compte inscrit sur le produit A qui arrive connecté sur le produit B, où il n'a
  jamais eu de bonus, reçoit une fois +3 crédits sur B (clé d'idempotence par
  utilisateur et produit) et un event signup pour B
- Revenir, se reconnecter ou recharger ne redonne jamais de bonus ni d'event signup
- Le solde de A ne bouge pas
Périmètre   : [app]/signup/complete/**, [app]/signup/_components/**, [app]/layout.tsx
              ou [app]/tool/** si le déclenchement y vit, lib/dal/credits.ts et
              lib/dal/events.ts (implémentation seulement), leurs tests
Hors périmètre : Q5
