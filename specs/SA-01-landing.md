# SA-01 · Landing
Réf         : Écrans › SA-01 · Next.js › cache et rendu · specs/mockups/SA-01.png
Contrat     : getProduct(slug), <TrackVisit>
Acceptation :
- /lettre-pro affiche hero, exemple de résultat, « comment ça marche », tarifs et
  FAQ, tous lus dans la config ; le CTA mène à /lettre-pro/tool
- 3 mises en page selon landing_variant du thème
- Page statique : generateStaticParams (≥ 1 slug), config en 'use cache' taguée
  product:{slug} ; instant() confirme que le shell s'affiche sans attente
- generateMetadata : title et description de la config présents dans le HTML
Périmètre   : [app]/page.tsx, [app]/_components/landing/**, e2e/landing.spec.ts
Hors périmètre : images OG, sitemap (I18N-SEO)
