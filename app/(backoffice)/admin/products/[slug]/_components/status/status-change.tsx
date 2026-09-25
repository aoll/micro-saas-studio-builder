"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Decision } from "@/lib/decision";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { setProductStatus, type SetProductStatusState } from "../../_actions";

export type StatusChangeProps = {
  productId: string;
  slug: string;
  name: string;
  status: ProductStatus;
  decision: Decision;
  justification: { visits: string; conversion: string; margin: string };
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  test: "Test",
  learn: "Learn",
  scale: "Scale",
  killed: "Killed",
};

const STATUSES: ProductStatus[] = ["test", "learn", "scale", "killed"];

const initialState: SetProductStatusState = {};

// docs/02-ecrans.md › BO-06: the modal opens preselected on the suggested
// status when there is one and it differs from the current status; a
// `null` decision (or a suggestion equal to the current status) leaves
// nothing selected, so the confirm button stays disabled until another
// status is chosen (QA1 B13: it used to open on "Test → Test").
function suggestedStatus(decision: Decision, current: ProductStatus): ProductStatus | null {
  const suggested = decision === "kill" ? "killed" : decision === "scale" ? "scale" : null;
  return suggested !== null && suggested !== current ? suggested : null;
}

// Its own component so it unmounts (and its useActionState resets) every
// time the dialog closes (plan's design: "The form lives in an inner
// component inside DialogContent, so its state resets on each open").
function StatusChangeForm({
  slug,
  name,
  status,
  decision,
  justification,
  onDone,
}: Omit<StatusChangeProps, "productId"> & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(setProductStatus.bind(null, slug), initialState);
  const [selected, setSelected] = useState<ProductStatus | null>(() => suggestedStatus(decision, status));

  useEffect(() => {
    if (state.ok) {
      toast.success("Statut mis à jour");
      onDone();
    }
  }, [state, onDone]);

  const isKilled = selected === "killed";

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="status" value={selected ?? ""} />

      {state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{STATUS_LABELS[status]}</span>
        <span aria-hidden="true">→</span>
        <span className="font-medium">{selected ? STATUS_LABELS[selected] : "…"}</span>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Nouveau statut</legend>
        {STATUSES.map((candidate) => (
          <label key={candidate} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="status-choice"
              value={candidate}
              checked={selected === candidate}
              disabled={candidate === status}
              onChange={() => setSelected(candidate)}
            />
            {STATUS_LABELS[candidate]}
          </label>
        ))}
      </fieldset>

      <div className="rounded-md border bg-muted/50 p-3 text-sm">
        <p className="font-medium">Ce que disent les chiffres</p>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-muted-foreground">Visites</dt>
            <dd>{justification.visits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Conversion</dt>
            <dd>{justification.conversion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Marge / génération</dt>
            <dd>{justification.margin}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="status-change-note">Note de décision</Label>
        <Textarea id="status-change-note" name="note" maxLength={500} rows={3} />
      </div>

      {isKilled ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Passer {name} en Killed ferme le produit : /{slug} affichera « produit introuvable » aux visiteurs.
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant={isKilled ? "destructive" : "default"} disabled={pending || selected === null}>
          {selected ? `Passer en ${STATUS_LABELS[selected]}` : "Passer en …"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// BO-06 (specs/BO-06-statut.md, docs/02-ecrans.md › "Changement de statut", specs/mockups/BO-06.png):
// a trigger that opens a modal with the current → new status, the 3 metrics that justify the
// decision, and a decision note. Killed needs an explicit destructive confirmation
// (docs/01-produit.md).
export function StatusChange(props: StatusChangeProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Changer de statut</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le statut de {props.name}</DialogTitle>
        </DialogHeader>
        {open ? <StatusChangeForm {...props} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
