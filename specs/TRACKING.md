# TRACKING · Events
Réf         : Modèle de données › events · Produit › Backoffice (funnel)
              · Next.js › TrackVisit et sendBeacon
Contrat     : implémente track(event) et <TrackVisit> (signatures gelées)
Acceptation :
- <TrackVisit> envoie un sendBeacon à [app]/api/events ; la landing reste statique
- Cookie anonymous_id posé s'il manque ; une visite par anonymous_id, produit et jour
- track() insère visit, first_generation, signup, generation, credits_exhausted,
  purchase avec user_id ou anonymous_id
- L'anonymous_id est conservé à l'inscription (lien visite → inscription)
Périmètre   : lib/dal/events.ts, [app]/api/events/**, components/track-visit.tsx,
              lib/dal/events.test.ts
