# QA1-P4-E1 · Les erreurs d'une étape corrigée s'effacent
Réf         : .claude/qa/reports/2026-09-25-creation-produit.md › B-P4-1 (validé par l'humain le 2026-09-25)
              · specs/BO-05a-formulaire.md › « Erreurs affichées à l'étape concernée »
Contrat     : productConfigSchema et validation.ts inchangés dans leur contrat
Dépend de   : —
Acceptation :
- Bloquer l'étape 5 avec {{inconnu}}, retirer la variable, « Suivant » : l'étape 6 s'ouvre et,
  en revenant à l'étape 5 (navigation latérale), plus aucun message d'erreur n'est affiché et
  l'onglet 5 n'est plus rouge dans StepNav
- Même règle pour chaque étape : quand « Suivant » valide une étape, les erreurs de cette étape
  sont purgées ; les erreurs des autres étapes (ex. renvoyées par le serveur à « Enregistrer »)
  restent tant qu'elles ne sont pas corrigées
- Les erreurs qui bloquent toujours (variable inconnue, clé dupliquée, slug pris) continuent de
  bloquer et de s'afficher
Plan        : court, dans la spec : test rouge dans product-form.test.tsx (le scénario ci-dessus,
              StepNav compris), puis correction minimale dans handleNext : remplacer les erreurs
              de l'étape courante par le résultat de validateStep (clés dont stepOfPath === étape),
              vide si valide ; e2e/product-form.spec.ts reste vert
Périmètre   : admin/products/_components/product-form/**, leurs tests, e2e/product-form.spec.ts
Hors périmètre : le reste du rapport
