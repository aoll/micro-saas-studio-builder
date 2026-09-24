# I18N-SEO · Anglais et référencement
Réf         : Stack › i18n · Next.js › Metadata
Acceptation :
- Chaque spec a livré ses textes en français et en anglais ; un test vérifie que
  messages/en/* a exactement les clés de messages/fr/* ; un produit locale=en
  affiche toute la sub-app en anglais
- opengraph-image.tsx et icon.tsx par produit, aux couleurs du thème
- sitemap.ts liste les produits actifs ; robots.ts exclut /admin
Périmètre   : i18n/messages.test.ts, [app]/opengraph-image.tsx, [app]/icon.tsx,
              app/sitemap.ts, app/robots.ts, e2e/seo.spec.ts
Hors périmètre : textes des autres zones (chaque spec livre les siens)
