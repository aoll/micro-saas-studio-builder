# CONTRACT-ui · Layouts, thèmes et composants partagés
Réf         : Produit › Thèmes · Écrans › Éléments transverses · Maquettes (toutes)
              · Next.js › routing
Contrat     : lit getProduct(), getBalance() (signatures de CONTRACT-types) ; expose
              les composants ci-dessous
Dépend de   : CONTRACT-types
Acceptation :
- (backoffice)/layout : shell shadcn, navigation complète (Portefeuille, Thèmes,
  Réglages), bouton de déconnexion (signOut de Better Auth), <Toaster/>
- (products)/[app]/layout : lit le root param, injecte les tokens du thème en
  variables CSS (clair et sombre), slot @modal avec default.tsx et [...catchAll]
- Les 4 thèmes rendent leur couleur primary sur /lettre-pro (test Playwright qui
  change le thème du produit en base)
- Composants : header produit avec badge de solde, footer, bandeau « Démo »
  (si DEMO_MODE), carte de résultat, carte de pack, champ dynamique (text, textarea,
  select), carte KPI, badge de statut, <TrackVisit> (stub, ne fait rien)
- États communs : skeleton, état vide avec action, toasts
- next-intl : i18n/request.ts lit la locale du produit ; messages/fr/common.json et
  messages/en/common.json créés ; chaque spec ajoute ensuite son fichier de zone
- Maquettes copiées dans specs/mockups/
Périmètre   : app/(backoffice)/layout.tsx, [app]/layout.tsx, [app]/@modal/default.tsx,
              [app]/@modal/[...catchAll]/**, components/**, app/globals.css,
              lib/fonts.ts, i18n/**, messages/*/common.json, specs/mockups/**
Hors périmètre : contenu des pages
