# QA1-P1-B4 · Une première visite compte une seule visite
Réf         : .claude/qa/reports/2026-09-25-full.md › B4 (validé par l'humain le 2026-09-25) · specs/TRACKING.md › Acceptation 2 · docs/07 › events
Contrat     : track() et les signatures de lib/dal/events.ts inchangées
Dépend de   : —
Acceptation :
- Un contexte navigateur neuf qui ouvre /{slug} une fois crée exactement un event
  visit et un seul anonymous_id, en dev (StrictMode, effet doublé) comme en prod
- Deux beacons de visite concurrents sans cookie pour le même navigateur ne créent
  pas deux visiteurs : l'anonymous_id vient d'un cookie posé une seule fois (serveur
  ou proxy), jamais d'un crypto.randomUUID() par beacon
- Les rechargements du même jour ne comptent toujours pas (docs/07 › events)
Périmètre   : components/track-visit.tsx, [app]/api/events/** (+ anonymous-id.ts),
              lib/dal/events.ts (implémentation seulement), proxy.ts si le cookie y est
              posé, leurs tests,
              e2e/visit-once.spec.ts, et la ligne `proxy.ts` de docs/04 (son rôle
              s'étend à ce cookie ; ni base ni autorisation)
Hors périmètre : B5, Q2, Q5
