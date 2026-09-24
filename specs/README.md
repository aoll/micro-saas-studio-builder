# Specs

Les specs de la démo, prêtes à copier dans `specs/`. Chaque bloc de code est le contenu exact d'un fichier. La méthode (boucle, contrats, vagues) est dans l'onglet Implémentation ; ici, uniquement les documents.

## Mode d'emploi

**Conventions**

- **Un fichier par feature** : `specs/<repère>-<nom>.md`. Le repère est un écran (`SA-05`, `BO-03`) ou une mécanique (`LEDGER`, `TRACKING`).
- **`Réf`** pointe vers le dossier (onglet › section) au lieu de répéter son contenu. Le dossier est exporté en markdown dans `docs/` pour que l'agent puisse le lire.
- **`Contrat`** : ce que la feature consomme ou implémente, gelé depuis V1.
- **`Acceptation`** : chaque puce devient au moins un test, Vitest ou Playwright.
- **`Périmètre`** : les seuls fichiers que l'agent peut créer ou modifier. Les chemins partent de `app/(products)/[app]/`, abrégé `[app]/`, ou de `app/(backoffice)/admin/`, abrégé `admin/`.
- **Une spec est validée quand elle est mergée sur `main`** (porte 1).

**Découpage par domaine** : chaque domaine (une route) regroupe ses Server Actions dans `<domaine>/_actions.ts`, au même niveau que `<domaine>/_components/`. Ex. `[app]/checkout/_actions.ts` et `[app]/checkout/_components/`, `admin/products/_actions.ts` et `admin/products/_components/`. Plus de fichier `actions.ts` partagé par zone. `messages/*/<zone>.json` désigne les deux langues : chaque spec livre son fichier en français **et** en anglais.

**Gabarit**

```md
# <REPÈRE> · <Nom>
Réf         : <onglet › section> · specs/mockups/<REPÈRE>.png
Contrat     : <signatures consommées ou implémentées>
Dépend de   : <specs mergées avant, s'il y en a>
Acceptation :
- <comportement observable>
Périmètre   : <chemins>
Hors périmètre : <ce qu'on ne fait pas ici>
```

**Contexte donné à chaque agent** : l'orchestrateur (skill `orchestrator`) lance les agents d'une spec — `triage`, puis `planner` et `tdd-guide` si le triage choisit le flux classique, relecteurs — avec le même brief, seul le nom de la spec change. Tout le dossier exporté dans `docs/` (hors cet onglet, les specs vivant dans `specs/`) est le contexte de la spec : chaque agent doit lire chaque document en entier avant de commencer, pas seulement les sections citées dans `Réf`.

```md
Spec : specs/<REF>-<nom>.md, dans ton worktree <chemin>.

1. Contexte : lis en entier CHAQUE document de docs/ (docs/README.md les liste).
   C'est le contexte de ta spec : produit, écrans, maquettes, modèle de données,
   arborescence, stack, choix Next.js et IA, méthode. Puis CLAUDE.md et la spec.
2. Fais ta part du flux : triage (triage), plan (planner), boucle TDD
   (tdd-guide) ou revue.
   TDD : un critère d'acceptation à la fois, test rouge, code minimal jusqu'au
   vert, commit et push ; enchaîne sans attendre.
3. Ne sors pas du périmètre, ne modifie aucun contrat : note le blocage et
   continue avec les autres critères. Un test commité ne se modifie que dans un
   commit à part qui explique pourquoi.
4. Rends ton rapport à l'orchestrateur : c'est lui qui enchaîne revue,
   /verify et PR. Tu ne merges jamais.
```

**Index**

| Spec | Vague | Lot | Dépend de | Priorité |
| --- | --- | --- | --- | --- |
| `SETUP-skeleton` | V0 | — | — | Indispensable |
| `CONTRACT-types` | V1 | C0 | SETUP | Indispensable |
| `CONTRACT-data` | V1 | C1 | CONTRACT-types | Indispensable |
| `CONTRACT-ui` | V1 | C2 | CONTRACT-types | Indispensable |
| `SA-01-landing` | V2 | A | Contrats | Indispensable |
| `SA-08-introuvable` | V2 | A | Contrats | Indispensable |
| `SA-02-outil` | V2 | A | Contrats | Indispensable |
| `SA-06-historique` | V2 | A | SA-02 | Indispensable |
| `LEDGER` | V2 | B | Contrats | Indispensable |
| `SA-03-inscription` | V2 | B | LEDGER | Indispensable |
| `SA-04-tarifs` | V2 | B | Contrats | Indispensable |
| `SA-05-paiement` | V2 | B | LEDGER, SA-04 | Indispensable |
| `SA-07-compte` | V2 | B | LEDGER | Bonus |
| `BO-01-connexion` | V2 | C | Contrats | Indispensable |
| `TRACKING` | V2 | C | Contrats | Indispensable |
| `BO-02-portefeuille` | V2 | C | TRACKING | Indispensable |
| `BO-03-fiche` | V2 | C | BO-02 | Indispensable |
| `BO-05a-formulaire` | V2 | D | Contrats | Indispensable |
| `BO-05b-generation-publication` | V2 | D | BO-05a, SA-02 | Indispensable |
| `BO-07-themes` | V2 | D | Contrats | Bonus |
| `DEMO-mode` | V3 | F | V2 | Indispensable |
| `SECURITY` | V3 | F | V2 | Indispensable |
| `I18N-SEO` | V3 | G | V2 | Indispensable |
| `BO-04-activite` | V3 | E | V2 | Bonus |
| `BO-06-statut` | V3 | E | BO-03 | Bonus |
| `BO-09-seuils` | V3 | E | BO-02 | Indispensable |
| `BO-08-editeur-theme` | V3 | G | BO-07 | Bonus, coupé en premier |
| `E2E-demo` | V4 | — | Tout | Indispensable |
