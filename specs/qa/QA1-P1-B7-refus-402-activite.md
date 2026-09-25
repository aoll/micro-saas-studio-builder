# QA1-P1-B7 · Un refus 402 n'est pas une génération
Réf         : .claude/qa/reports/2026-09-25-full.md › B7 (validé par l'humain le 2026-09-25) · specs/BO-04-activite.md · docs/07 › generations, ledger
Contrat     : signatures DAL inchangées ; debit() renvoie toujours { ok: false,
              reason: 'insufficient_balance' }
Dépend de   : QA1-P1-B5-premiere-generation, QA1-P1-L1-lot-leger
Acceptation :
- Une génération refusée faute de crédit (402) n'écrit aucune ligne generations (ou
  n'apparaît pas dans l'activité BO-04) ; l'event credits_exhausted reste enregistré
- L'activité d'un produit liste exactement les générations servies ou échouées
  après débit (remboursées), pas les refus
- Débit avant l'appel IA, remboursement sur échec : inchangés
Périmètre   : [app]/api/generate/route.ts, lib/dal/generations.ts, lib/dal/activity.ts
              (implémentation), admin/products/[slug]/activity/_components/generations-table.tsx,
              leurs tests
Hors périmètre : Q5
