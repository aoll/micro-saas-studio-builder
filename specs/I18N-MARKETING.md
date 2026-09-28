# I18N-MARKETING · Sélecteur de langue landing et making-of
Réf         : Accueil › Les décisions clés · Produit › Contenu des produits seedés › Langues ·
              Stack › i18n › Landing et making-of · Arborescence › (marketing), i18n/, messages/
Contrat     : i18n/marketing-routing.ts (defineRouting), i18n/marketing-navigation.ts
              (createNavigation), i18n/request.ts (aiguillage produit / marketing / backoffice,
              ajoute une branche sans changer la signature ni le comportement de la branche
              produit déjà consommée par (products)/[app])
Acceptation :
- Sur `/` et `/making-of`, une première visite sans cookie `NEXT_LOCALE` affiche la page dans la
  langue du navigateur si elle vaut fr ou en, en français sinon (Accept-Language, autres langues
  → fr par défaut)
- Un sélecteur visible dans le header de la landing et du making-of bascule entre `/…` (fr) et
  `/en/…` (en), pose le cookie `NEXT_LOCALE` et cette préférence l'emporte sur la détection lors
  des visites suivantes
- `/en` et `/en/making-of` répondent 200, entièrement en anglais (textes de `_components/` et
  `_data/run.ts` compris) ; `/making-of` (sans préfixe) reste en français
- Les URLs `/{slug}` des produits, `/admin*` et `/api/*` ne passent jamais par le middleware
  next-intl du groupe marketing : la locale d'un produit et celle du backoffice restent
  inchangées, aucune régression sur SA-01, I18N-SEO ou BO-01
- `proxy.ts` garde un seul export `proxy` ; le commentaire de son `config.matcher` (« `/` alone
  … there is no route there ») est corrigé puisque `/` et `/making-of` sont désormais de vraies
  routes
Périmètre   : proxy.ts, i18n/marketing-routing.ts, i18n/marketing-navigation.ts, i18n/request.ts,
              messages/{fr,en}/marketing.json, messages/{fr,en}/making-of.json,
              app/(marketing)/layout.tsx, app/(marketing)/page.tsx,
              app/(marketing)/making-of/page.tsx, app/(marketing)/_components/**,
              app/(marketing)/making-of/_components/**, app/(marketing)/making-of/_data/run.ts,
              app/(marketing)/_components/locale-switcher.tsx, e2e/marketing-locale.spec.ts,
              e2e/home.spec.ts, e2e/making-of.spec.ts (pin `test.use({ locale: "fr-FR" })`,
              precondition change only, documented in the commit)
Hors périmètre : la locale des produits (`(products)/[app]`, inchangée), le sélecteur du
              backoffice (I18N-BACKOFFICE), toute traduction du contenu déjà spécifique à un
              produit
