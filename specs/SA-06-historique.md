# SA-06 · Historique
Réf         : Écrans › SA-06 · specs/mockups/SA-06.png
Contrat     : implémente listGenerations(userOrAnonId, productId, page) dans
              lib/dal/history.ts
Dépend de   : SA-02
Acceptation :
- Liste paginée (20 par page), la plus récente d'abord : date, entrées résumées,
  début du résultat
- Rouvrir affiche le résultat complet ; copier fonctionne
- État vide avec lien vers l'outil ; jamais mis en cache, streamé sous <Suspense>
- Un utilisateur ne voit jamais les générations d'un autre (test)
Périmètre   : [app]/history/**, lib/dal/history.ts, messages/*/history.json,
              e2e/history.spec.ts
