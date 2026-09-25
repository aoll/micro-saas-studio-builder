# QA1-P5-E2 · Messages de validation numériques en français
Réf         : .claude/qa/reports/2026-09-25-creation-produit-2.md › B-P5-1 (validé par l'humain le 2026-09-25)
              · specs/BO-05a-formulaire.md › « Erreurs affichées à l'étape concernée »
Contrat     : productConfigSchema (lib/schemas/**) inchangé ; seule la traduction de validation.ts évolue
Dépend de   : —
Acceptation :
- Étape 6, « Coût par génération » à -1 (ou 0) puis « Suivant » : l'étape reste bloquée et le
  message affiché est en français (ex. « Minimum : 1 »), jamais le brut Zod « Too small: … »
- Même règle pour chaque champ numérique du formulaire (crédits offerts à l'inscription,
  générations gratuites anonymes, crédits et prix des packs, et tout autre `z.int()`/`z.number()`
  borné du schéma) : minimum et maximum traduits, y compris un nombre non entier si le schéma
  l'interdit
- Les messages existants (chaînes : « Ce champ est requis », « N caractères minimum/maximum »,
  table FRENCH_MESSAGES) sont inchangés ; « Enregistrer » renvoie la même formulation
  (issuesToErrors est partagé)
Plan        : court, dans la spec : tests rouges dans validation.test.ts (toFrenchMessage /
              validateStep sur chaque champ numérique borné), puis extension minimale de
              toFrenchMessage pour `origin: "number"` (too_small / too_big, inclusif ou non) et
              `invalid_type` / `not_multiple_of` éventuels d'un entier ; vert
Périmètre   : admin/products/_components/product-form/validation.ts et ses tests
Hors périmètre : lib/schemas/** (contrat gelé), le reste du rapport
