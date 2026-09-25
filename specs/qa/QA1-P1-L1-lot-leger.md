# QA1-P1-L1 · Lot léger : dix corrections locales
Réf         : .claude/qa/reports/2026-09-25-full.md › B1, B2, B6, B8, B9, B10, B11, B13, B15, B16 (validé par l'humain le 2026-09-25)
Mode        : léger, décision humaine du 2026-09-25 : un agent, un worktree, sans
              boucle test-first ni plan ; /review et /verify restent obligatoires,
              pnpm check vert. Un test existant qui casse se met à jour dans un
              commit qui dit pourquoi ; un test de régression bon marché est bienvenu
Contrat     : aucun contrat gelé ne change
Dépend de   : —
Acceptation :
- B1 : /admin/products/new et /admin/products/[slug]/edit s'affichent sans erreur ;
  plus aucun import de node:crypto dans un module client (crypto.randomUUID global)
  [BO-05a › 1]
- B2 : app/(products)/[app]/signup/_actions.ts n'exporte que des fonctions async ;
  l'état initial vit dans un module à part ; « Recevoir mon lien de connexion »
  mène à la boîte de réception simulée, en fr et en en [SA-03 › 2-3]
- B6 : colonne « Marge » du portefeuille = marge sur 30 jours du produit (revenu −
  coût IA, en € ou en % comme la maquette BO-02) ; la colonne produit est la
  première, avec son en-tête « Produit » [docs/02 › BO-02 · mockup BO-02]
- B8 : coût IA lisible partout (activité, fiche, portefeuille) : micro-dollars
  convertis avec la bonne unité et assez de décimales pour qu'un coût non nul ne
  s'affiche jamais « 0,000 € » [BO-04 · mockup BO-04]
- B9 : un champ requis vide affiche le message traduit de messages/*/tool.json sous
  le champ, pas l'infobulle native (noValidate + validation Zod), sans appel réseau
  [SA-02 › 1]
- B10 : un lien magique expiré ou déjà utilisé affiche le titre expired.title
  (« Lien expiré » / « Link expired »), le message et « Recevoir un nouveau lien »
  [SA-03 › 4]
- B11 : à 0 crédit, le bouton de génération n'affiche jamais de solde négatif (pas
  de -1 optimiste sous 0 : bouton désactivé ou état « solde insuffisant ») ;
  anglais « 0 credits » [docs/01 › Mécanique des crédits · I18N-SEO › 1]
- B13 : la modale de statut s'ouvre sans nouveau statut présélectionné égal à
  l'actuel ; « Passer en … » reste désactivé tant qu'aucun autre statut n'est choisi
  [BO-06 › 1]
- B15 : le mock streame en chunkDelayInMs: 30 (docs/05 › Stratégie de mock)
- B16 : les séries des courbes 30 j ont des couleurs distinctes, comme la maquette
  BO-03 (Visites violet, Achats orange pointillé) [BO-03 › 2]
Périmètre   : admin/products/_components/product-form/** , [app]/signup/_actions.ts,
              [app]/signup/_components/** (+ un module d'état à côté),
              admin/_components/portfolio/** , admin/products/[slug]/activity/_lib/**,
              admin/products/[slug]/_components/trend-chart.tsx, les formateurs de coût
              de admin/products/[slug]/_components/**, components/product/dynamic-field.tsx,
              components/product/balance.tsx, [app]/tool/_components/**,
              admin/products/[slug]/_components/status/status-change.tsx, lib/ai/model.ts,
              messages/*/common.json, messages/*/tool.json, messages/*/auth.json, et les
              tests de ces fichiers
Hors périmètre : B3, B4, B5, B7, B12, B14, M1, Q2, Q5 (specs à part)
