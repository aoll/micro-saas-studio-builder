# TOOLING-test-transaction · Isolation transactionnelle des tests DB
Réf         : décision humaine du 2026-09-25 (fin du run v1) : reprendre de castflow
              `withTestTransaction` (packages/db-test-client/src/test-db.ts) et un
              `max` explicite pour le pool de test ; motivé par les six tests
              intermittents du run v1 (#47), tous dus à des données partagées entre
              fichiers de test sur la base du worktree
Contrat     : aucune signature DAL ne change ; `db` (lib/db) garde son type
Dépend de   : —
Acceptation :
- `withTestTransaction(fn)` exécute `fn` dans une transaction Postgres
  toujours annulée (rollback), que le test passe ou échoue ; aucune ligne
  écrite pendant `fn` ne subsiste ensuite
- Pendant `fn`, tout le code qui passe par `db` (DAL, Route Handlers et
  Server Actions appelés directement par le test) s'exécute dans cette même
  transaction, sans changer une seule signature de la DAL ; un
  `db.transaction()` imbriqué devient un savepoint
- Hors `withTestTransaction`, `db` se comporte exactement comme avant
  (production, dev, tests existants)
- Le pool Postgres des tests a un `max` explicite plus bas que celui de
  l'application, documenté, sans `process.env` lu dans le code applicatif
- Les tests du run v1 qui nettoyaient à la main des données partagées
  (au minimum lib/dal/generations.test.ts, account.test.ts, history.test.ts,
  activity.test.ts) passent sur `withTestTransaction` quand ils n'ont pas
  besoin de plusieurs connexions ; les tests de concurrence réelle
  (Promise.all qui prouvent un verrou ou une idempotence entre connexions)
  gardent leur schéma actuel, et la règle est écrite dans
  .claude/skills/tdd-workflow
Périmètre   : lib/db/index.ts (+ test), lib/db/test-transaction.ts (+ test),
              lib/env.ts (+ test) et .env.example si une variable de pool est
              nécessaire, les fichiers de test migrés, .claude/skills/tdd-workflow/**
