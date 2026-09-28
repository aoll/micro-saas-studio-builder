# BO-01 · Connexion admin
Réf         : Écrans › BO-01 · Produit › Mode démo public · specs/mockups/BO-01.png
Contrat     : getSession, requireAdmin
Acceptation :
- /admin/login : email + mot de passe ; mauvais identifiants → erreur sans
  préciser lequel
- Champs préremplis avec les identifiants du compte `owner` quand
  `SEED_OWNER_EMAIL` et `SEED_OWNER_PASSWORD` sont définies, pour faciliter
  la démo (décision humaine du 2026-09-28, qui remplace « champs vides »),
  avec un message dans la carte qui le signale ; vides et sans message
  sinon. Les identifiants admin (`SEED_ADMIN_*`) ne sont jamais affichés
- Toutes les pages /admin appellent requireAdmin() (pas seulement le layout) ; un
  compte role=user est redirigé
- Le bouton de déconnexion du shell (CONTRACT-ui) ramène sur /admin/login
Périmètre   : admin/login/** (dont _actions.ts et _components/), e2e/admin-auth.spec.ts
