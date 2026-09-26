# SA-09 · Facture et pool de jobs PDF
Réf         : Nouvelle fonctionnalité (hors dossier initial, décidée avec l'utilisateur
              après le lancement) · s'appuie sur Produit › Mécanique des crédits (table
              `purchases`) et Vercel › Blob pour le contexte déjà en place
Contrat     : getBalance (gelé, lecture seule) ; implémente enqueueInvoiceMonths,
              claimNextInvoiceJob, completeInvoiceJob, failInvoiceJob, listInvoiceJobs
              (lib/dal/invoice-jobs.ts), renderInvoicePdf (lib/invoice/render.tsx), et la
              table `invoice_jobs`
Dépend de   : LEDGER (table `purchases`, déjà gelée)
Acceptation :
- Un utilisateur connecté voit, sur `/{slug}/account/invoices`, la liste des mois
  facturables : chaque mois avec au moins un achat, du premier achat jusqu'au mois
  précédent le mois courant inclus (le mois en cours n'est jamais facturable, il n'est
  pas terminé)
- Il coche un ou plusieurs mois et lance « Générer » : chaque mois devient un job en
  base (`invoice_jobs`, statut `queued`), un par mois, idempotent (rejouer la même
  sélection ne crée pas de doublon)
- Le pool traite au plus 2 jobs à la fois **par utilisateur et par produit** : avec 5
  mois sélectionnés, 2 passent en `processing` immédiatement, les 3 autres restent
  `queued` jusqu'à ce qu'un slot se libère — visible en direct dans la liste (`queued`
  → `processing` → `done`), sans re-sélection ni ré-appui du visiteur
- Un job terminé produit un vrai PDF (récapitulatif des achats du mois : packs, crédits,
  montant, date), stocké sur Vercel Blob ; la ligne affiche un lien de téléchargement
- Un job qui dépasse son délai (15 s) passe `failed` avec un message clair, sans bloquer
  ni faire échouer les autres jobs du pool ; un bouton « réessayer » ne relance que ce
  job-là (repasse à `queued`, redébloque un slot pour lui)
- Un mois sans aucun achat n'est pas sélectionnable ; un job ne peut jamais être créé
  pour un mois sans achat
- Générique par construction : ne lit que `product`/`purchases`/la session courante,
  jamais un slug ou un nom de produit en dur — LettrePro, DescriPro et NomDeMarque
  l'ont automatiquement dès le merge, aucune config supplémentaire par produit
- Chaque utilisateur ne voit et ne peut agir que sur ses propres jobs (la Server Action
  revérifie la session et le userId à chaque appel, jamais fait confiance au client)
Périmètre   : [app]/account/invoices/** (dont _actions.ts et _components/),
              lib/dal/invoice-jobs.ts, lib/dal/invoice-jobs.test.ts,
              lib/invoice/render.tsx, lib/invoice/render.test.tsx,
              lib/db/schema.ts (ajout de la table `invoice_jobs` uniquement),
              drizzle/** (migration générée), messages/*/invoices.json,
              e2e/invoices.spec.ts, package.json (ajout de `@react-pdf/renderer`)
Hors périmètre : envoi de la facture par email, export comptable, TVA/mentions légales
              réelles (mentions de démo suffisent), job pooling partagé entre produits
              ou entre utilisateurs (le pool est scoped à un couple utilisateur+produit)
