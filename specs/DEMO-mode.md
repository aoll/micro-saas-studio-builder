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
  Note (run v1, 2026-09-25) : les deux exigences ont été retirées par décision
  humaine : pas de verrou sur les lignes is_seed (la démo est réinitialisée
  avant chaque présentation ; guards.ts supprimé, #44) et pas de limite de
  produits visiteurs (#45). DEMO_MODE=true affiche le bandeau « Démo » et fait
  refuser au seed les identifiants de développement.
- /admin/ops réservé au rôle owner (404 sinon) ; bouton « Réinitialiser » qui
  lance scripts/reset-demo.ts : supprime tout ce qui n'est pas is_seed, rejoue
  l'usage du seed
  Note (run qa1, 2026-09-25) : pour un anonyme, vrai 404 HTTP (proxy.ts,
  QA1-P1-B12). Pour un admin ou un user connecté (pas owner), décision
  humaine : contenu 404 en français, rien de la page ops, noindex, mais
  statut HTTP 200 accepté — limite de Cache Components (Next 16.3) : une
  fois le streaming commencé, notFound() ne peut plus changer le statut
  déjà envoyé ; le seul point qui verrait un statut réel avant le rendu est
  proxy.ts, qui n'y lit ni base ni rôle (docs/04). L'owner reçoit toujours
  un vrai 200.
- DEMO_MODE=false en local et en test : tout est modifiable
  Note (run v1, 2026-09-25) : sans verrou (#44), tout est modifiable quel que
  soit DEMO_MODE.
Périmètre   : scripts/seed.ts, scripts/reset-demo.ts, fixtures/**, admin/ops/**,
              lib/dal/guards.ts, e2e/demo-mode.spec.ts
              Note (run v1, 2026-09-25) : lib/dal/guards.ts retiré par décision
              humaine (#44).
Hors périmètre : cron nocturne (bonus)
