# SECURITY · BotID et rate limit
Réf         : Vercel › BotID · Coûts › Redis · Modèle de données › index generations
Acceptation :
- guardRequest(kind) appelle checkBotId() puis le rate limit ; il est déjà appelé
  par api/generate, l'inscription, purchase et « Tester le prompt » ; initBotId
  dans instrumentation-client.ts
- Rate limit Postgres : N générations par 60 s par utilisateur et par ip_hash
  (N dans lib/env.ts) → 429 avec message clair
- Budget AI Gateway plafonné (réglage documenté dans le README)
Périmètre   : lib/security.ts, lib/rate-limit.ts, instrumentation-client.ts,
              next.config.ts (withBotId), lib/security.test.ts, lib/rate-limit.test.ts
