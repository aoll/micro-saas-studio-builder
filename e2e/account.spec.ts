import { expect, test } from "@playwright/test";

// SA-07 acceptance, played end to end against /lettre-pro/account. Not run
// yet (written now, run in the E2E phase, docs/11-implementation.md › V4
// Package): needs a real browser to exercise cookies and navigation
// together, and no header entry point links here yet (plan's Orchestrator
// decision 3: header-balance is a follow-up) so every test navigates by
// URL.
//
// Notes for whoever runs this:
// - The not-signed-in journey now exercises SA-03's real `/lettre-pro/signup`
//   page and its intercepted modal (`@modal/(.)signup`, merged #35):
//   `OpenSignupModal`'s `router.replace` turns the hard `page.goto` to
//   `/account` into a soft navigation to `/signup`, which opens the modal
//   over the account page's own shell (docs/04-nextjs.md's intercepting
//   routes) — the same "dialog" role and "Email" field as
//   e2e/signup.spec.ts's own modal assertion.
// - The signed-in journey (balance, movements, purchases, sign-out) needs
//   a real session, reachable only through SA-03's magic-link flow (no
//   email+password sign-up for regular users, lib/auth.ts:
//   `disableSignUp: true`) — the same gap left as a placeholder in
//   e2e/tool.spec.ts and e2e/history.spec.ts for the same reason. Sign in
//   with SA-03's UI (e2e/signup.spec.ts's second test: fill "Email", click
//   "Recevoir mon lien de connexion", then "Me connecter" in the simulated
//   inbox) before asserting the balance card, MovementList, PurchaseList
//   and AccountSignOutButton content.

test.describe("Account (/lettre-pro/account)", () => {
  test("a not-signed-in visitor is sent to the sign-up modal", async ({ page }) => {
    await page.goto("/lettre-pro/account");
    await expect(page).toHaveURL(/\/lettre-pro\/signup$/);
    await expect(page.getByText("Créez un compte pour voir vos crédits")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  // Placeholder: needs a real session (see the file header). Once
  // available: sign in, then assert the balance card ("Solde", the number
  // of credits, "Recharger" → /lettre-pro/pricing), the "Mouvements de
  // crédits" and "Achats" lists, the "Voir mes générations" link to
  // /lettre-pro/history, and that "Se déconnecter" signs out and returns to
  // /lettre-pro.
});
