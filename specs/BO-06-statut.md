# BO-06 · Changement de statut
Réf         : Écrans › BO-06 · Produit › Statut Test → Learn → Scale → Killed
Contrat     : implémente updateStatus(productId, status, note) dans
              lib/dal/product-status.ts ; appelle assertEditable
Dépend de   : BO-03
Acceptation :
- Modale sur BO-03 : statut actuel → nouveau, métriques qui justifient, note
  enregistrée dans status_note
- Passage en killed : confirmation explicite ; la sub-app renvoie ensuite 404
- updateTag product:{slug} et products
Périmètre   : admin/products/[slug]/_components/status/**,
              admin/products/[slug]/_actions.ts, lib/dal/product-status.ts,
              e2e/status.spec.ts
