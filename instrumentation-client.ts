import { initBotId } from "botid/client/core";

// SECURITY (specs/SECURITY.md): pairs with guardRequest's server-side
// checkBotId(). Every POST origin that guardRequest protects (SA-02's
// api/generate, SA-03's signup, SA-05's purchase, BO-05's "Tester le
// prompt") must be listed here too, or BotID logs a misconfiguration
// warning and cannot classify the request. Paths are the *page* a Server
// Action posts to, not the action's file: SignupFlow renders under both
// signup/page.tsx and @modal/(.)signup/page.tsx, but both serve the same
// URL, `/{slug}/signup`; same for checkout.
initBotId({
  protect: [
    { path: "/*/api/generate", method: "POST" }, // SA-02, api/generate/route.ts
    { path: "/*/signup", method: "POST" }, // SA-03, signup/_actions.ts requestMagicLink
    { path: "/*/checkout/*", method: "POST" }, // SA-05, checkout/_actions.ts purchase
    { path: "/admin/products/new", method: "POST" }, // BO-05, "Tester le prompt" on create
    { path: "/admin/products/*/edit", method: "POST" }, // BO-05, "Tester le prompt" on edit
  ],
});
