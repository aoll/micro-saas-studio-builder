# BO-01 · Connexion admin
Réf         : Écrans › BO-01 · Produit › Mode démo public · specs/mockups/BO-01.png
Contrat     : getSession, requireAdmin
Acceptation :
- /admin/login : email + mot de passe ; mauvais identifiants → erreur sans
  préciser lequel
- Champs vides : les identifiants sont envoyés avec la candidature, pas affichés
- Toutes les pages /admin appellent requireAdmin() (pas seulement le layout) ; un
  compte role=user est redirigé
- Le bouton de déconnexion du shell (CONTRACT-ui) ramène sur /admin/login
Périmètre   : admin/login/** (dont _actions.ts et _components/), e2e/admin-auth.spec.ts
