# QA1-P3-F1 · Formulaire produit : étape 5 → 6 et clés en double à l'étape 4
Réf         : .claude/qa/reports/2026-09-25-full-3.md › B-N1, B-N2 (validé par l'humain le 2026-09-25)
              · specs/BO-05a-formulaire.md › Acceptation 5-6 · specs/BO-05b-generation-publication.md › 1
Contrat     : productConfigSchema et validation.ts (VALID_BASELINE) inchangés dans leur contrat
Dépend de   : —
Acceptation :
- B-N1 : à l'étape 5, « Suivant » valide les variables {{…}} du template contre les vrais champs
  du brouillon (étape 4), pas contre les champs de l'exemple de validation.ts : avec la config
  bio-instagram importée intacte, « Suivant » passe à l'étape 6 ; une variable sans champ
  (ex. {{inconnu}}) bloque toujours l'étape 5 avec « Variable {{inconnu}} sans champ correspondant »
- B-N2 : à l'étape 4, deux champs avec la même clé n'émettent plus d'erreur React « two children
  with the same key » dans generation-step.tsx ni prompt-tester.tsx (clés React stables, par ex.
  l'id client du champ) ; le message « Clé déjà utilisée » et le blocage de l'étape restent
Plan        : court, dans la spec : test rouge par constat (product-form.test.tsx pour B-N1 :
              import de la fixture puis « Suivant » depuis l'étape 5 ; test de rendu pour B-N2
              qui échoue sur l'avertissement de clé dupliquée), puis correction minimale :
              stepPatch(5) transmet aussi les inputs du brouillon (toConfig(draft).inputs),
              clés React sur l'id client ; e2e/product-form.spec.ts reste vert
Périmètre   : admin/products/_components/product-form/**, leurs tests, e2e/product-form.spec.ts
Hors périmètre : le reste du rapport de la passe 3
