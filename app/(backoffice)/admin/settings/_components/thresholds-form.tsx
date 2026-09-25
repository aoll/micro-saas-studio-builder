"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Thresholds } from "@/lib/dal/thresholds";
import { thresholdsInputSchema } from "@/lib/schemas/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveThresholdSettings, type ThresholdsActionState } from "../_actions";
import { parsePercentInput, percentToRate, rateToPercent } from "./percent";
import { previewChanges, type PreviewProduct } from "./preview";

const initialState: ThresholdsActionState = {};

// BO-09 spec bullet 1: the studio's default seuils (`/admin/settings`),
// with a live preview of the products whose badge would change (bullet 4).
export function ThresholdsForm({ defaults, products }: { defaults: Thresholds; products: PreviewProduct[] }) {
  const [minVisits, setMinVisits] = useState(String(defaults.minVisits));
  const [killPercent, setKillPercent] = useState(String(rateToPercent(defaults.killMaxConversion)));
  const [scalePercent, setScalePercent] = useState(String(rateToPercent(defaults.scaleMinConversion)));
  const [requiresMargin, setRequiresMargin] = useState(defaults.scaleRequiresPositiveMargin);
  const [state, formAction, pending] = useActionState(saveThresholdSettings.bind(null, null), initialState);

  useEffect(() => {
    if (state.ok) toast.success("Seuils par défaut enregistrés");
    if (state.formError) toast.error(state.formError);
  }, [state]);

  const errors = state.errors ?? {};

  const candidate = useMemo(() => {
    const parsed = thresholdsInputSchema.safeParse({
      minVisits: Number(minVisits),
      killMaxConversion: percentToRate(parsePercentInput(killPercent)),
      scaleMinConversion: percentToRate(parsePercentInput(scalePercent)),
      scaleRequiresPositiveMargin: requiresMargin,
    });
    return parsed.success ? parsed.data : null;
  }, [minVisits, killPercent, scalePercent, requiresMargin]);

  const changes = useMemo(
    () => (candidate ? previewChanges(products, defaults, { kind: "default" }, candidate) : []),
    [candidate, products, defaults],
  );

  return (
    <form action={formAction} className="grid gap-4 rounded-md border p-4">
      <h2 className="text-lg font-semibold">Seuils par défaut du studio</h2>

      <div className="grid gap-1.5">
        <Label htmlFor="default-min-visits">Visites minimales</Label>
        <Input
          id="default-min-visits"
          name="minVisits"
          type="number"
          value={minVisits}
          onChange={(event) => setMinVisits(event.target.value)}
          aria-invalid={errors.minVisits ? "true" : undefined}
        />
        {errors.minVisits ? <p className="text-sm text-destructive">{errors.minVisits}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="default-kill">Conversion « à couper » (%)</Label>
        <Input
          id="default-kill"
          name="killMaxConversion"
          type="number"
          step="0.01"
          value={killPercent}
          onChange={(event) => setKillPercent(event.target.value)}
          aria-invalid={errors.killMaxConversion ? "true" : undefined}
        />
        {errors.killMaxConversion ? <p className="text-sm text-destructive">{errors.killMaxConversion}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="default-scale">Conversion « à scaler » (%)</Label>
        <Input
          id="default-scale"
          name="scaleMinConversion"
          type="number"
          step="0.01"
          value={scalePercent}
          onChange={(event) => setScalePercent(event.target.value)}
          aria-invalid={errors.scaleMinConversion ? "true" : undefined}
        />
        {errors.scaleMinConversion ? <p className="text-sm text-destructive">{errors.scaleMinConversion}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="default-margin"
          type="checkbox"
          name="scaleRequiresPositiveMargin"
          checked={requiresMargin}
          onChange={(event) => setRequiresMargin(event.target.checked)}
        />
        <Label htmlFor="default-margin">Marge positive exigée pour scaler</Label>
      </div>

      {changes.length > 0 ? (
        <div className="rounded-md border border-dashed p-3 text-sm">
          <p className="font-medium">Badges qui changeraient :</p>
          <ul className="list-disc pl-4">
            {changes.map((change) => (
              <li key={change.productId} data-testid="preview-change">
                {change.name} : {change.before ?? "—"} → {change.after ?? "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        Enregistrer
      </Button>
    </form>
  );
}
