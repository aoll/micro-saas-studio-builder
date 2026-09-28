"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

// I18N-BACKOFFICE-STRINGS (lot 3): the 4 statuses stay identical in French
// and English on purpose (spec's "Décisions de portée" — already English
// loanwords in the French UI), coded as a literal record rather than a
// message key.
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
  const t = useTranslations("backoffice-decision");
  const locale = useLocale();
  // I18N-BACKOFFICE-STRINGS (lot 3): locale is bound after slug (the spec's
  // "en dernier paramètre" among the client-supplied arguments — the two
  // that follow, prevState and formData, come from useActionState itself),
  // never in the FormData: setProductStatus uses it to translate its own
  // error messages.
  const [state, formAction, pending] = useActionState(setProductStatus.bind(null, slug, locale), initialState);
  const [selected, setSelected] = useState<ProductStatus | null>(() => suggestedStatus(decision, status));

  useEffect(() => {
    if (state.ok) {
      toast.success(t("statusChange.successToast"));
      onDone();
    }
  }, [state, onDone, t]);

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
        <legend className="text-sm font-medium">{t("statusChange.newStatus")}</legend>
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
        <p className="font-medium">{t("statusChange.numbersTitle")}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <dt className="text-muted-foreground">{t("statusChange.visits")}</dt>
            <dd>{justification.visits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("statusChange.conversion")}</dt>
            <dd>{justification.conversion}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("statusChange.margin")}</dt>
            <dd>{justification.margin}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="status-change-note">{t("statusChange.noteLabel")}</Label>
        <Textarea id="status-change-note" name="note" maxLength={500} rows={3} />
      </div>

      {isKilled ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t("statusChange.killedWarning", { name, slug })}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("statusChange.cancel")}
        </Button>
        <Button type="submit" variant={isKilled ? "destructive" : "default"} disabled={pending || selected === null}>
          {selected ? t("statusChange.confirm", { status: STATUS_LABELS[selected] }) : t("statusChange.confirmPending")}
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
  const t = useTranslations("backoffice-decision");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">{t("statusChange.trigger")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("statusChange.dialogTitle", { name: props.name })}</DialogTitle>
        </DialogHeader>
        {open ? <StatusChangeForm {...props} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
