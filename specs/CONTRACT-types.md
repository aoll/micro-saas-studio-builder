# CONTRACT-types · Types et signatures figés
Réf         : Implémentation › Les contrats gelés en V1 · Modèle de données (tout)
              · Produit › Configuration d'un produit
Contrat     : crée les types et les signatures de tous les contrats de V1
Dépend de   : SETUP
Acceptation :
- lib/schemas : productConfig, themeTokens, eventType, pack (Zod) et leurs types
  inférés ; un config invalide (variable {{x}} sans champ x, slug réservé
  admin/api) est rejeté
- Signatures exportées, corps throw new Error('not implemented') : toutes les
  fonctions du tableau des contrats (lib/dal/*), assertEditable et isEditable
  (lib/dal/guards.ts), guardRequest(kind) (lib/security.ts)
  Note (run v1, 2026-09-25) : le verrou démo a été retiré par décision humaine ;
  assertEditable, isEditable, Lockable et lib/dal/guards.ts n'existent plus (#44).
- pnpm typecheck vert
Périmètre   : lib/schemas/**, lib/dal/*.ts (signatures), lib/security.ts
Hors périmètre : tables, migrations, implémentations (CONTRACT-data)
