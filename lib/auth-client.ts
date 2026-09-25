"use client";

import { createAuthClient } from "better-auth/react";

// The only client-side auth file (docs/09-arborescence.md): signIn is a
// Server Action (admin/login/_actions.ts); this client is only used for
// signOut (SignOutButton, docs/02-ecrans.md).
export const authClient = createAuthClient();
