# QA1-P6-E3 · Chaque champ du pricing affiche son erreur
Réf         : .claude/qa/reports/2026-09-25-creation-produit-3.md › B-P6-1 (validé par l'humain le 2026-09-25)
              · specs/BO-05b-generation-publication.md › étape 6 · specs/BO-05a-formulaire.md › « Erreurs affichées à l'étape concernée »
Contrat     : productConfigSchema (lib/schemas/**) et validation.ts inchangés
Dépend de   : —
Acceptation :
- Étape 6 : crédits offerts à l'inscription à -1, générations gratuites anonymes à -1, crédits
  d'un pack à 0, prix d'un pack à 0 → « Suivant » bloque ET le message français de validation.ts
  s'affiche sous le champ concerné (aria-invalid, même présentation que le coût par génération)
- Chaque champ numérique ou texte de l'étape 6 qui peut porter une erreur (y compris le nom ou
  le libellé d'un pack s'il est validé) l'affiche ; aucune erreur de l'étape 6 n'est muette
- Un pack à 0 crédit (ou un prix invalide) n'affiche jamais « $Infinity » ni « NaN » comme marge :
  la marge de ce pack s'affiche « — » tant que le pack est invalide
- Les affichages existants (coût par génération, liste des packs, identifiant de pack) inchangés
Plan        : court, dans la spec : tests rouges dans pricing-step.test.tsx (un par champ, plus la
              marge d'un pack à 0 crédit) et margin.test.ts s'il existe ; puis affichage des erreurs
              manquantes dans pricing-step.tsx sur le modèle de pricing.costPerGeneration, et garde
              credits <= 0 dans margin.ts (ou à son appel) ; vert
Périmètre   : admin/products/_components/product-form/pricing-step.tsx, margin.ts, leurs tests
Hors périmètre : lib/schemas/**, validation.ts, le reste du rapport
