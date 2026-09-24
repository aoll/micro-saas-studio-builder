# SA-02 · Outil et génération
Réf         : Écrans › SA-02 · Produit › Mécanique des crédits (diagramme) · IA
              · specs/mockups/SA-02.png
Contrat     : getProduct, getBalance, debit, refund, track, resolveModel, guardRequest
              (gelés) ; implémente recordGeneration, markGenerationFailed,
              renderPrompt(template, input) et POST [app]/api/generate
Acceptation :
- Le formulaire est généré depuis config.fields ; champs requis validés (Zod)
- Générer → clé d'idempotence client → guardRequest('generate') → débit →
  streamText → la réponse s'affiche en streaming ; recordGeneration enregistre
  la génération (modèle, tokens, cost_micros)
- Échec IA → markGenerationFailed, refund appelé, message « crédit remboursé »
- Anonyme : 1 génération gratuite par cookie + IP, puis la modale /signup s'ouvre
- Débit refusé (solde insuffisant) → 402, event credits_exhausted, la modale
  /pricing s'ouvre
- Events first_generation et generation envoyés via track()
- Carte de résultat : copier, télécharger, regénérer
Périmètre   : [app]/tool/** (dont _components/), [app]/api/generate/**,
              lib/dal/generations.ts, lib/ai/generate.ts, lib/ai/prompt.ts, messages/*/tool.json,
              e2e/tool.spec.ts
Hors périmètre : contenu des modales /signup et /pricing (lot B), BotID et rate
                 limit derrière guardRequest (SECURITY)
