# I18N-BACKOFFICE · Sélecteur de langue backoffice
Réf         : Accueil › Les décisions clés · Produit › Contenu des produits seedés › Langues ·
              Stack › i18n › Backoffice · Architecture rules (schéma gelé)
Contrat     : i18n/request.ts (branche backoffice : cookie `admin_locale`, ajoutée sans changer
              la branche produit)
Acceptation :
- Un sélecteur fr/en dans le shell du backoffice (CONTRACT-ui) change la langue de tout
  `/admin/**` sans recharger la session ni changer d'URL (pas de préfixe `/en`)
- Le choix pose un cookie `admin_locale` (`fr` ou `en`) ; sans cookie, le backoffice reste en
  français, comme avant cette spec
- Aucune détection automatique du navigateur pour le backoffice (décision : un admin choisit,
  il ne subit pas une devinette derrière une authentification)
- Aucune colonne ajoutée à `users` ni à toute autre table de `lib/db/schema.ts` : le schéma
  gelé n'est pas touché, la préférence ne vit que dans le cookie
- Les messages d'erreur renvoyés par une Server Action de `admin/**` respectent la langue reçue
  en argument (le cookie n'est pas relu dans une Server Action, cf. Stack › i18n)
Périmètre   : i18n/request.ts, messages/{fr,en}/backoffice.json,
              app/(backoffice)/layout.tsx, app/(backoffice)/admin/_components/locale-switcher.tsx,
              e2e/backoffice-locale.spec.ts
Hors périmètre : la locale des produits et celle de la landing/making-of (I18N-MARKETING), toute
              migration de `lib/db/schema.ts`
