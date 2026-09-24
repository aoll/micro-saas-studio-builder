import "server-only";

// Frozen contract (specs/CONTRACT-types.md, orchestrator decision 1). SA-03
// has no `lib/dal` file in its own Périmètre but must show the simulated
// inbox (docs/08-stack.md: "Après « Recevoir mon lien », une modale « Boîte
// de réception (démo) » s'ouvre et affiche l'email"). Frozen here so
// CONTRACT-data can implement it and SA-03 can consume it.
//
// Called only by the signup Server Action (SA-03), right after
// `signInMagicLink` for that same email, in the same request. Admin and
// owner emails never have a row: SETUP's `sendMagicLink` writes the link
// to the database instead of sending it (docs/08), but only for regular
// users, so a demo visitor typing an admin email finds nothing here.
// Showing the link to whoever typed the email is the dossier's accepted
// demo design; the call is throttled by `guardRequest("signup")`.
export const getLatestMagicLink: (email: string) => Promise<{ url: string; createdAt: Date } | null> = async () => {
  throw new Error("not implemented");
};
