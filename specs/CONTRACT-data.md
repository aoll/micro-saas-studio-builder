# CONTRACT-data · Schéma, DAL en stubs, seed minimal
Réf         : Modèle de données (tout) · IA › mock et seed
              · Implémentation › Les contrats gelés en V1
Contrat     : implémente les signatures de CONTRACT-types (réelles ou stubs typés)
Dépend de   : CONTRACT-types
Acceptation :
- Les 10 tables métier, contraintes et index du Modèle de données ; migration
  générée ; drizzle-kit check vert
- getProduct('lettre-pro') renvoie la config parsée de la version courante ;
  getProduct('inconnu') renvoie null
- Stubs : getBalance → 10 ; debit → { ok: true } ; purchase → { balance: 20 } ;
  track → no-op ; getFunnel / getPortfolioMetrics → chiffres fixes plausibles ;
  createProduct / updateStatus → insertion simple ; recordGeneration /
  markGenerationFailed → insertion simple ; assertEditable / isEditable → ne
  bloquent rien ; guardRequest → laisse tout passer ; getThresholds(productId)
  réel (défaut du studio fusionné avec la surcharge du produit, tag 'thresholds')
- Chaque stub a un test de contrat (types + forme de la réponse) que la vraie
  implémentation devra passer
- resolveModel() : mock en AI_MODE=mock, rejoue fixtures/lettre-pro.json en streaming
- pnpm db:seed idempotent : 4 thèmes, LettrePro, compte admin, compte owner,
  seuils par défaut (1 000 visites, 2 %, 5 %, marge positive)
Périmètre   : lib/db/**, lib/dal/**, lib/security.ts, lib/ai/model.ts, fixtures/**,
              scripts/seed.ts, drizzle/**
Hors périmètre : schémas Zod (CONTRACT-types), ledger réel, métriques réelles,
                 3 autres produits seedés (DEMO-mode)
