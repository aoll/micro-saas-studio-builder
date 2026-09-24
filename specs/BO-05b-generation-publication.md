# BO-05b · Génération, pricing, publication
Réf         : Écrans › BO-05 (étapes 5 à 7) · IA › coût par génération
              · Next.js › updateTag
Contrat     : resolveModel, renderPrompt (SA-02), guardRequest ; implémente
              publishProduct dans lib/dal/product-editor.ts
Dépend de   : BO-05a, SA-02
Acceptation :
- Étape 5 : modèle, template avec les {{variables}} cliquables, type de sortie ;
  une variable sans champ correspondant bloque l'étape
- « Tester le prompt » : guardRequest('test-prompt'), génération depuis le backoffice, résultat, tokens, coût
- Étape 6 : crédits offerts, coût par génération, packs ; marge estimée affichée
- Étape 7 : récapitulatif, Publier → current_version mis à jour, updateTag
  product:{slug} et products → /{slug} est à jour à la requête suivante ; lien
  vers /{slug}
- Aperçu en direct de la landing pendant la saisie (coupable : bouton « Voir la
  landing » si le temps manque)
Périmètre   : admin/products/_components/product-form/** (étapes 5-7, aperçu),
              admin/products/_actions.ts (test, publication),
              lib/dal/product-editor.ts (publication), e2e/publish.spec.ts
