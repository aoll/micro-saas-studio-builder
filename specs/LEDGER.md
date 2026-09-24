# LEDGER · Ledger de crédits
Réf         : Modèle de données › credit_transactions, balances, invariants, extrait
              Drizzle · Produit › Mécanique des crédits
Contrat     : implémente getBalance, debit, refund, grantSignupBonus, purchase
              (signatures gelées, tests de contrat inchangés)
Acceptation :
- debit : solde 3, coût 1 → 2 ; même clé rejouée → solde inchangé, { replay: true }
- debit : solde 0 → renvoie { ok: false, reason: 'insufficient_balance' } (pas
  d'exception), aucune ligne dans le ledger
- debit sans ligne balances (jamais crédité sur ce produit) → même refus ;
  getBalance → 0
- Concurrence : solde 1, deux débits simultanés → un seul passe
- refund : clé dérivée de generation_id → un seul remboursement même appelé deux fois
- grantSignupBonus : +3 une seule fois par utilisateur et par produit
- Premier crédit (bonus ou achat) sans ligne balances → la ligne est créée (upsert)
  avec le bon solde
- purchase : achat + ligne +N dans la même transaction ; crédits et prix recopiés
  du pack ; double clic → un seul achat
- Après chaque scénario : balance = somme du ledger
Périmètre   : lib/dal/credits.ts, lib/dal/credits.test.ts
Hors périmètre : UI
