# QA1-P2-S1 · Étape 1 : un slug pris ou réservé est refusé
Réf         : .claude/qa/reports/2026-09-25-full-2.md › Recheck et Étape 3.3 (validé par l'humain le 2026-09-25) : doute levé par l'agent de QA1-P1-M1
              (e2e/product-form.spec.ts « creates a product through steps 1-4 … » : « Ce slug
              est déjà utilisé » ne s'affiche pas après Suivant) · specs/BO-05a-formulaire.md
              › Acceptation 2 · specs/CONTRACT-types.md › 1
Contrat     : checkSlug et slugSchema inchangés (lib/schemas/** gelé)
Dépend de   : —
Acceptation :
- À l'étape 1 de /admin/products/new, saisir un slug déjà pris (lettre-pro) puis « Suivant »
  affiche « Ce slug est déjà utilisé » sous le champ Slug et reste à l'étape 1
- Même chose pour un slug réservé (admin) : « Ce slug est réservé »
- Un slug libre passe à l'étape 2 sans erreur
- e2e/product-form.spec.ts « creates a product through steps 1-4, then saves a second draft
  version » passe, sans affaiblir ses assertions
Plan        : court, dans la spec : reproduire d'abord (test unitaire du formulaire ou e2e) ;
              si le comportement est correct et que seul le test e2e est faux, corriger le test
              dans un commit à part qui explique pourquoi ; sinon corriger la cause dans le
              formulaire (appel de checkSlug à « Suivant », affichage de l'erreur)
Périmètre   : admin/products/_components/product-form/**, admin/products/_actions.ts
              (checkSlug : implémentation seulement), leurs tests, e2e/product-form.spec.ts
Hors périmètre : QA1-P2-N1
