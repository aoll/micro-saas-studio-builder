"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ResetDemoState } from "../_actions";

const initialState: ResetDemoState = {};

// `_actions.ts` transitively imports the DAL and scripts/reset-demo.ts's
// own Postgres client — a static import here would drag that into every
// test that renders this component (mirrors status-change.tsx's own
// comment for the exact same reason).
async function callResetDemoAction(prevState: ResetDemoState, formData: FormData): Promise<ResetDemoState> {
  const { resetDemoAction } = await import("../_actions");
  return resetDemoAction(prevState, formData);
}

// specs/DEMO-mode.md (orchestrator decision 7): a destructive two-step
// confirm, no navigation link anywhere pointing at this page. The first
// click only reveals the confirmation step; the Server Action only ever
// runs from the second, explicit click.
export function ResetForm() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(callResetDemoAction, initialState);

  // Collapses back to the first step the moment a *new* successful result
  // arrives — adjusted during render, not in an effect (React docs:
  // "storing information from previous renders"), so it converges within
  // the same render pass instead of a setState-in-effect's extra one.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) setConfirming(false);
  }

  useEffect(() => {
    if (state.ok) toast.success("Démo réinitialisée");
    else if (state.error) toast.error(state.error);
  }, [state]);

  if (!confirming) {
    return (
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)}>
        Réinitialiser la démo
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">
        {state.error ??
          "Cette action supprime les produits créés par les visiteurs et toute l'activité, puis rejoue le seed. Irréversible."}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="destructive" disabled={pending}>
          Confirmer la réinitialisation
        </Button>
      </div>
    </form>
  );
}
