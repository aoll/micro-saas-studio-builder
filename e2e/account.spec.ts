import { expect, test } from "@playwright/test";

// SA-07 acceptance, played end to end against /lettre-pro/account. Not run
// yet (written now, run in the E2E phase, docs/11-implementation.md › V4
// Package): needs a real browser to exercise cookies and navigation
// together, and no header entry point links here yet (plan's Orchestrator
// decision 3: header-balance is a follow-up) so every test navigates by
// URL.
//
// Notes for whoever runs this:
// - The not-signed-in journey (plan's Orchestrator decision 2) needs
//   SA-03's `/lettre-pro/signup` page and its intercepted modal to exist:
//   until SA-03 is merged, the account page's `href={.../signup as Route}`
//   points at a route that 404s. Marked `test.fixme` with that reason;
//   un-fixme and drop the reason once SA-03 merges.
// - The signed-in journey (balance, movements, purchases, sign-out) needs
//   a real session, reachable only through SA-03's magic-link flow (no
//   email+password sign-up for regular users, lib/auth.ts:
//   `disableSignUp: true`) — the same gap left as a placeholder in
//   e2e/tool.spec.ts and e2e/history.spec.ts for the same reason. Once
//   SA-03 is merged, sign in with its UI (or auth.api.signInMagicLink +
//   the outbox's verify URL, lib/auth.ts:18-22,55 and
//   lib/dal/magic-link.ts:19-27, the pattern e2e/history.spec.ts's plan
//   entry names) before asserting the balance card, MovementList,
//   PurchaseList and AccountSignOutButton content.

test.describe("Account (/lettre-pro/account)", () => {
  test.fixme("a not-signed-in visitor is sent to the sign-up modal (needs SA-03's /lettre-pro/signup)", async ({
    page,
  }) => {
    await page.goto("/lettre-pro/account");
    await expect(page).toHaveURL(/\/lettre-pro\/signup$/);
    await expect(page.getByText("Créez un compte pour voir vos crédits")).toBeVisible();
  });

  // Placeholder: needs SA-03's magic-link sign-in (see the file header).
  // Once available: sign in, then assert the balance card ("Solde", the
  // number of credits, "Recharger" → /lettre-pro/pricing), the "Mouvements
  // de crédits" and "Achats" lists, the "Voir mes générations" link to
  // /lettre-pro/history, and that "Se déconnecter" signs out and returns to
  // /lettre-pro.
});
