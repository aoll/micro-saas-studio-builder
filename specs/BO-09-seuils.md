# BO-09 · Réglages des seuils
Réf         : Écrans › BO-09 · Modèle de données › decision_thresholds
              · pas de maquette : formulaire shadcn standard, dans le shell du backoffice
Contrat     : getThresholds (gelé) ; implémente saveThresholds(productId | null, values)
Dépend de   : BO-02
Acceptation :
- /admin/settings : seuils par défaut du studio (visites minimales, conversion
  « à couper », conversion « à scaler » en %, marge positive exigée)
- Surcharge par produit : choisir un produit, modifier un ou plusieurs champs ;
  « Réinitialiser » supprime la surcharge
- « à couper » ≥ « à scaler » → erreur de validation (Zod et CHECK en base)
- Avant d'enregistrer : aperçu des produits dont le badge changerait
- Enregistrer → updateTag('thresholds') ; les badges de BO-02 et BO-03 suivent à la
  requête suivante
- Mode démo : réglage par défaut en lecture seule, surcharges permises sur les
  produits créés par le visiteur
Périmètre   : admin/settings/** (dont _actions.ts et _components/),
              lib/dal/thresholds.ts (écriture), e2e/settings.spec.ts
