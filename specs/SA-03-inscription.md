# SA-03 · Inscription par lien magique
Réf         : Écrans › SA-03 · Stack › Better Auth · specs/mockups/SA-03.png
Contrat     : grantSignupBonus, track, guardRequest
Dépend de   : LEDGER
Acceptation :
- Après la génération gratuite, un lien discret sur l'outil ouvre la modale
  (intercepting route) quand le visiteur clique dessus, plutôt que de s'ouvrir
  automatiquement ; /signup en accès direct affiche la page complète
- Email saisi → guardRequest('signup') → boîte de réception simulée en modale, aux couleurs du produit,
  bouton « Me connecter » qui suit le vrai lien magique
- Connexion → +3 crédits (une seule fois), event signup relié à l'anonymous_id,
  retour sur l'outil avec le solde à jour
- Lien expiré → message et bouton pour en recevoir un nouveau
Périmètre   : [app]/signup/** (dont _actions.ts et _components/),
              [app]/@modal/(.)signup/**, messages/*/auth.json,
              e2e/signup.spec.ts
