# BO-05a · Formulaire produit : étapes 1 à 4 et sauvegarde
Réf         : Écrans › BO-05 (étapes 1 à 4) · Produit › Configuration d'un produit
              · Modèle de données › product_versions · specs/mockups/BO-05.png
Contrat     : productConfig (Zod) ; implémente createProduct, saveVersion dans
              lib/dal/product-editor.ts ; appelle assertEditable avant toute écriture
              Note (run v1, 2026-09-25) : exigence retirée par décision humaine, pas
              de verrou démo ; assertEditable n'existe plus (#44).
Acceptation :
- /admin/products/new et /admin/products/[slug]/edit, formulaire en étapes
- Étape 1 : nom, slug dérivé du nom et modifiable, unicité vérifiée, statut initial
- Étape 2 : vignettes des thèmes en base, logo (upload Blob), couleur optionnelle
- Étape 3 : titres, FAQ éditable, meta avec compteur de caractères
- Étape 4 : champs (clé, libellé, type, requis, options), réordonnés par boutons
  monter / descendre ; clés uniques
- Erreurs affichées à l'étape concernée (même schéma Zod côté serveur)
- Enregistrer → nouvelle ligne product_versions (jamais de mise à jour en place),
  brouillon non publié
Périmètre   : admin/products/new/**, admin/products/[slug]/edit/**,
              admin/products/_components/product-form/**, admin/products/_actions.ts,
              lib/dal/product-editor.ts, e2e/product-form.spec.ts
