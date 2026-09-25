# CONTRACT-remove-demo-lock · Retrait du verrouillage démo
Réf         : décision humaine du 2026-09-25 (run v1) : les lignes is_seed ne sont
              pas verrouillées en mode démo ; « le verrouillage doit être nettoyé,
              pas de code mort »
Contrat     : supprime assertEditable, isEditable et Lockable de lib/dal/guards.ts
Dépend de   : —
Acceptation :
- lib/dal/guards.ts supprimé ; plus aucun appel à assertEditable ni isEditable
  dans les DAL d'écriture (product-editor, product-status, themes, thresholds)
- Les écrans qui lisaient isEditable n'ont plus d'état « lecture seule » lié au
  mode démo : édition produit, éditeur de thème, réglages des seuils (props
  readOnly / editable et textes « verrouillé en mode démo » retirés s'ils ne
  servent qu'à ça)
- Tests de contrat (contract.test.ts, contract-shape.test.ts) et tests des
  appelants mis à jour dans des commits expliqués ; aucun autre comportement ne change
- is_seed reste en base (utilisé par le seed et la remise à zéro)
Périmètre   : lib/dal/guards.ts (+ test), lib/dal/{product-editor,product-status,
              themes,thresholds}.ts (+ tests), lib/dal/contract.test.ts,
              lib/dal/contract-shape.test.ts, admin/products/[slug]/edit/**,
              admin/products/_components/product-form/** (si readOnly n'y sert
              qu'au verrou), admin/themes/[id]/**, admin/settings/**,
              e2e/*.spec.ts qui testent le verrou
