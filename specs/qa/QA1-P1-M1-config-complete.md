# QA1-P1-M1 · Formulaire produit : config complète et import « prête à coller »
Réf         : .claude/qa/reports/2026-09-25-full.md › M1 (validé par l'humain le 2026-09-25) · docs/01 › Contenu des produits seedés · specs/SA-01-landing.md
              › Acceptation 1 · docs/05 › L'AI SDK dans la démo · docs/02 › BO-05
Contrat     : productConfigSchema inchangé (il porte déjà exampleOutput, steps, systemPrompt)
Dépend de   : QA1-P1-L1-lot-leger
Acceptation :
- Étape 3 (Landing & SEO) : champs pour l'exemple de résultat et les étapes
  « comment ça marche » (ajout, suppression, ordre) ; l'aperçu les montre
- Étape 5 (Génération) : champ prompt système
- Import d'une config JSON collée (celle de fixtures/bio-instagram.config.json) :
  remplit toutes les étapes, validée par le même schéma Zod, erreurs par étape ;
  le thème se choisit par son nom si l'id ne correspond pas
- Un produit créé ainsi a sur sa landing l'exemple et « comment ça marche »
Périmètre   : admin/products/_components/product-form/**, admin/products/new/**,
              admin/products/[slug]/edit/page.tsx (étendu après revue : même brouillon),
              leurs tests, e2e/product-form.spec.ts
Hors périmètre : Q1 (écarté), Q3 (écarté)
