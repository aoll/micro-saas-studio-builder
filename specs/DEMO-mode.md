# DEMO-mode · Démo publique
Réf         : Produit › Mode démo public, Contenu des produits seedés
              · Modèle de données › Migrations et seed · IA › mock et seed
Acceptation :
- Seed complet : LettrePro (Scale), DescriPro (Learn), NomDeMarque (Test, « à
  couper »), historiques depuis les fixtures, 30 jours d'events qui racontent
  l'histoire ; config BioInsta prête à coller dans fixtures/bio-instagram.config.json
- DEMO_MODE=true : produits, thèmes et seuils par défaut is_seed non modifiables (assertEditable dans
  lib/dal/guards.ts, déjà appelé par les DAL d'écriture ; boutons désactivés via
  isEditable) ; 10 produits visiteurs au maximum
- /admin/ops réservé au rôle owner (404 sinon) ; bouton « Réinitialiser » qui
  lance scripts/reset-demo.ts : supprime tout ce qui n'est pas is_seed, rejoue
  l'usage du seed
- DEMO_MODE=false en local et en test : tout est modifiable
Périmètre   : scripts/seed.ts, scripts/reset-demo.ts, fixtures/**, admin/ops/**,
              lib/dal/guards.ts, e2e/demo-mode.spec.ts
Hors périmètre : cron nocturne (bonus)
