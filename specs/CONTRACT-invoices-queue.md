# CONTRACT-invoices-queue · Pool de factures sur Vercel Queues
Réf         : Étude technique « migration vers Vercel Queues » (doc de conception, 2026-09-27) ·
              specs/SA-09-facture.md (feature d'origine, dont ce contrat remplace le pool)
Contrat     : retire `claimNextInvoiceJob` et `MAX_CONCURRENT_INVOICE_JOBS` de
              `lib/dal/invoice-jobs.ts` (signatures gelées par SA-09-facture) ; ajoute la
              route consumer `app/api/queues/invoices/route.ts` (`queue/v2beta`) et son
              trigger dans `vercel.json`
Dépend de   : SA-09-facture
Acceptation :
- `generateInvoices()` et `retryInvoice()` publient un message par job (`send('invoices', ...)`)
  au lieu d'appeler `after(() => runInvoicePool())` ; `enqueueInvoiceMonths()` est inchangé
- La route consumer traite un message : rend le PDF (timeout 15 s inchangé), upload sur
  Blob, puis `completeInvoiceJob()`/`failInvoiceJob()` — comportement identique à l'actuel
  `processInvoiceJob()`
- La concurrence redevient globale à la plateforme : le plafond « au plus 2 par utilisateur
  et par produit » disparaît, remplacé par un plafond de concurrence sur le consumer group
  (mécanisme natif de Vercel Queues ; point de configuration exact — dashboard du projet ou
  équivalent — à documenter dans ce fichier une fois trouvé pendant l'implémentation).
  `claimNextInvoiceJob()` et `MAX_CONCURRENT_INVOICE_JOBS` sont supprimés de
  `lib/dal/invoice-jobs.ts`
- L'upload Blob est protégé contre les doublons de redélivrance (delivery *at-least-once*) :
  le nom de fichier inclut une clé dérivée du `messageId` ou de l'idempotency key envoyée à
  `send()`, jamais un nom purement aléatoire à chaque tentative
- Un message qui échoue de façon définitive (mois sans achat, erreur non transitoire) est
  acquitté après un nombre borné de tentatives (`deliveryCount`), jamais redélivré
  indéfiniment
- Le front (`job-status-list.tsx`, polling de `invoice_jobs`) n'est pas modifié :
  `invoice_jobs` reste l'unique source de statut pour l'UI
- `pnpm check` reste vert ; les tests qui mockaient `after()`/`claimNextInvoiceJob` mockent
  désormais `send()`/`@vercel/queue`, jamais le vrai SDK
Périmètre   : lib/dal/invoice-jobs.ts (retrait de claimNextInvoiceJob et
              MAX_CONCURRENT_INVOICE_JOBS + son test de concurrence),
              lib/dal/invoice-jobs.test.ts, app/api/queues/invoices/route.ts (+ test),
              app/(products)/[app]/account/invoices/_actions.ts (+ test), vercel.json,
              package.json (ajout de @vercel/queue)
Hors périmètre : mode poll, Vercel Workflows, dead-letter queue applicative au-delà du
              retry natif, granularité de concurrence par utilisateur et par produit
              (option écartée par l'étude technique — un choix produit à revisiter si un
              scénario de démo l'exige un jour)
