"use client";

import { startTransition, useEffect, useRef } from "react";
import { claimSignupBonus } from "../complete/_actions";

const STORAGE_KEY_PREFIX = "msb:signup-claimed:";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 4:
// rendered only when a session exists (Suspense-gated by
// CrossProductSignupBonus, step 5), so it never mounts for an anonymous
// visitor nor in the pre-rendered landing shell. On mount, calls the
// claimSignupBonus Server Action once via startTransition (the exact
// calling convention already used by CheckoutFlow's purchase() call). A
// localStorage flag skips the call on a later mount in the same browser --
// a pure optimization, never the correctness mechanism: correctness is
// already guaranteed by grantSignupBonus's and track's own idempotency
// keys (lib/dal/credits.ts, lib/dal/events.ts), unaffected by localStorage.
// A rejected call is swallowed and simply retried on the next real page
// load (deliberate, not a bug).
export function ClaimCrossProductBonus({ slug }: { slug: string }) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const storageKey = `${STORAGE_KEY_PREFIX}${slug}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1") return;

    startTransition(() => {
      claimSignupBonus(slug)
        .then((result) => {
          if (result.ok && typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, "1");
          }
        })
        .catch(() => {
          // Swallowed: correctness doesn't depend on this call succeeding
          // now, only on it eventually running again (plan's risk note).
        });
    });
  }, [slug]);

  return null;
}
