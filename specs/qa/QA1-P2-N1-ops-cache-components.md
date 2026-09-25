# QA1-P2-N1 · /admin/ops sans erreur Cache Components
Réf         : .claude/qa/reports/2026-09-25-full-2.md › N1 (validé par l'humain le 2026-09-25) · docs/04 › Rendu et cache · specs/DEMO-mode.md (et sa note du run qa1)
              · specs/qa/QA1-P1-B12-statut-http.md, specs/qa/QA1-P1-B14-cache-components.md
Contrat     : getSession() et requireAdmin() gardent leur signature
Dépend de   : —
Acceptation :
- L'owner qui ouvre /admin/ops (arrivée directe et navigation depuis /admin) ne produit plus
  « uncached data during prerendering or a navigation … outside of <Suspense> » en console,
  dans get_errors du MCP next-devtools ni dans le journal du serveur
- Comportement inchangé : owner 200 avec « Opérations » et le bouton de remise à zéro ;
  anonyme vrai 404 (proxy.ts) ; admin ou user connecté contenu 404 français sans rien de la
  page ops (statut 200 accepté, note du run qa1) ; require-admin-coverage.test.ts vert
- Aucune donnée de session mise en cache ; le shell reste statique là où il l'est (docs/04)
Plan        : court, dans la spec (constat mineur) : reproduire d'abord l'erreur sur un vrai
              serveur de dev (port 3300+), comprendre pourquoi requireAdmin() au premier niveau
              de ops/page.tsx la déclenche (lien possible avec l'io() ajouté par QA1-P1-B14),
              puis la correction la plus locale : la vérification owner et requireAdmin() dans
              un composant sous <Suspense> (fallback discret), ou l'équivalent documenté par
              Next 16.3 ; un test verrouille la structure, la vérification réelle se fait sur le
              serveur de dev et par e2e/admin-http-status.spec.ts et e2e/demo-mode.spec.ts
Périmètre   : admin/ops/page.tsx (+ _components/** et not-found.tsx si besoin), leurs tests,
              lib/dal/session.ts (implémentation seulement) si la cause y est
Hors périmètre : QA1-P2-S1
