# Scénarios QA

Un scénario dit **quoi** vérifier et **contre quelle référence** ; la skill
`qa` (`../SKILL.md`) dit comment. `full.md` couvre toute la plateforme ; les
autres ciblent une feature, à lancer après son implémentation ou après un run.

| Fichier | Couvre |
|---|---|
| `full.md` | Toute la plateforme, dans l'ordre du script de démo (docs/01) |
| `sous-app-funnel.md` | SA-01 → SA-08 sur un produit seedé : visiteur, inscrit, paywall, paiement |
| `backoffice-pilotage.md` | BO-01, BO-02, BO-03, BO-04, BO-06, BO-09 : décider sur la donnée |
| `creation-produit.md` | BO-05a, BO-05b : créer et publier BioInsta, puis l'ouvrir |
| `themes.md` | BO-07, BO-08, thèmes appliqués aux sub-apps (CONTRACT-ui) |
| `demo-ops.md` | DEMO-mode, SECURITY : `/admin/ops`, bandeau, rate limit, BotID, remise à zéro |
| `i18n-seo.md` | I18N-SEO, SA-01 (metadata) : produit anglais, sitemap, robots, OG, icône |

## Écrire un scénario

Un fichier `<nom>.md`, en français, avec ces sections dans cet ordre :

1. **Objectif** : une ou deux phrases, ce que la passe doit prouver.
2. **Specs et docs couvertes** : les specs (`specs/SA-05-paiement.md`) et les
   sections du dossier (`docs/02 › SA-05`), les maquettes (`specs/mockups/SA-05.png`).
3. **Persona(s)** : parmi celles de `../config.md` › Personas.
4. **Préconditions** : base seedée, serveur lancé, produit créé par un autre
   scénario, variable d'environnement particulière…
5. **Étapes** numérotées. Chaque étape : l'action (route réelle, libellé exact
   tiré de `messages/*/*.json` ou du JSX), le **résultat attendu**, et sa
   **référence** entre crochets (`[SA-05 › Acceptation 3]`, `[docs/02 › SA-02
   États]`). Une étape = une ligne du tableau du rapport, identifiée par son
   numéro (`4.2` pour un sous-point).
6. **Nettoyage** : ce qu'il faut restaurer (thème, seuils, statut), et si la
   remise à zéro ou le re-seed est prévue.

Règles :

- Des routes et des libellés **réels** : vérifiés dans le code au moment de
  l'écriture. Un libellé qui change dans le code se corrige ici.
- L'attendu vient du dossier ou d'une spec, jamais du comportement observé.
  Une exigence retirée par une note de run (« Note (run v1…) ») n'est pas
  attendue.
- Concis : pas de pas-à-pas de clics évidents, la skill lit le code pour les
  trouver.
- Un scénario n'efface rien sans le dire dans ses préconditions et son
  nettoyage.
