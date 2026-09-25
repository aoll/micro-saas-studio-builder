# QA1-P1-B12 · Vrais statuts HTTP pour /admin/ops et /admin sans session
Réf         : .claude/qa/reports/2026-09-25-full.md › B12 (validé par l'humain le 2026-09-25) · specs/DEMO-mode.md › Acceptation 3 · docs/01 › Mode démo
              public · specs/SETUP-skeleton.md › Acceptation 4
Contrat     : requireAdmin / requireOwner inchangés
Dépend de   : QA1-P1-B4-visite-double (proxy.ts)
Acceptation :
- GET /admin/ops par un anonyme, un admin ou un user répond HTTP 404 (pas 200 avec
  NEXT_HTTP_ERROR_FALLBACK dans le corps), et la page 404 est en français
- GET /admin sans session répond une redirection (307/308) vers /admin/login, sans
  servir le shell du portefeuille
- L'owner reçoit toujours /admin/ops en 200 ; l'admin connecté reçoit /admin en 200
Périmètre   : admin/ops/page.tsx, admin/ops/not-found.tsx (nouveau), admin/loading.tsx
              (suppression, docs/04 › pas de loading.tsx par page ; étendu par
              l'orchestrateur après le plan), admin/page.tsx, app/(backoffice)/layout.tsx,
              la ligne `proxy.ts` de docs/04,
              proxy.ts (une garde de session optimiste, docs/04), leurs tests,
              e2e/admin*.spec.ts
Hors périmètre : le reste de SECURITY
