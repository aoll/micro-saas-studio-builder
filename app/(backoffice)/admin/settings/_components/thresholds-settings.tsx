"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { thresholdsInputSchema } from "@/lib/schemas/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetProductThresholds, saveThresholdSettings, type ThresholdsActionState } from "../_actions";
import { parsePercentInput, percentToRate, rateToPercent } from "./percent";
import { mergeThresholds, previewChanges } from "./preview";
import type { SettingsView } from "./settings-view";
import { ThresholdsForm } from "./thresholds-form";

const initialSaveState: ThresholdsActionState = {};
const initialResetState: ThresholdsActionState = {};

// BO-09 spec bullets 2, 4, 6: one product's override, picked from a native
// `<select>` (plan design decision 9), pre-filled with its own merged
// values (its overridden fields, the studio defaults otherwise) —
// `key={product.productId}` on this whole sub-component resets that local
// state whenever the picker changes product, instead of manually syncing
// four fields in an effect.
function ProductOverrideForm({
  product,
  defaults,
  allProducts,
}: {
  product: SettingsView["products"][number];
  defaults: SettingsView["defaults"]["values"];
  allProducts: SettingsView["products"];
}) {
  const merged = mergeThresholds(defaults, product.override);
  const [minVisits, setMinVisits] = useState(String(merged.minVisits));
  const [killPercent, setKillPercent] = useState(String(rateToPercent(merged.killMaxConversion)));
  const [scalePercent, setScalePercent] = useState(String(rateToPercent(merged.scaleMinConversion)));
  const [requiresMargin, setRequiresMargin] = useState(merged.scaleRequiresPositiveMargin);
  const [saveState, saveAction, savePending] = useActionState(
    saveThresholdSettings.bind(null, product.productId),
    initialSaveState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetProductThresholds.bind(null, product.productId),
    initialResetState,
  );

  useEffect(() => {
    if (saveState.ok) toast.success("Surcharge enregistrée");
    if (saveState.formError) toast.error(saveState.formError);
  }, [saveState]);

  useEffect(() => {
    if (resetState.ok) toast.success("Surcharge réinitialisée");
    if (resetState.formError) toast.error(resetState.formError);
  }, [resetState]);

  const editable = product.editable;
  const errors = saveState.errors ?? {};

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
    () =>
      candidate
        ? previewChanges(allProducts, defaults, { kind: "product", productId: product.productId }, candidate)
        : [],
    [candidate, allProducts, defaults, product.productId],
  );

  return (
    <form action={saveAction} className="grid gap-4 rounded-md border p-4">
      <h3 className="font-medium">
        {product.name}
        {product.override ? " (surchargé)" : ""}
      </h3>

      <div className="grid gap-1.5">
        <Label htmlFor="product-min-visits">Visites minimales (produit)</Label>
        <Input
          id="product-min-visits"
          name="minVisits"
          type="number"
          value={minVisits}
          disabled={!editable}
          onChange={(event) => setMinVisits(event.target.value)}
          aria-invalid={errors.minVisits ? "true" : undefined}
        />
        {errors.minVisits ? <p className="text-sm text-destructive">{errors.minVisits}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-kill">Conversion « à couper » (%) (produit)</Label>
        <Input
          id="product-kill"
          name="killMaxConversion"
          type="number"
          step="0.01"
          value={killPercent}
          disabled={!editable}
          onChange={(event) => setKillPercent(event.target.value)}
          aria-invalid={errors.killMaxConversion ? "true" : undefined}
        />
        {errors.killMaxConversion ? <p className="text-sm text-destructive">{errors.killMaxConversion}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-scale">Conversion « à scaler » (%) (produit)</Label>
        <Input
          id="product-scale"
          name="scaleMinConversion"
          type="number"
          step="0.01"
          value={scalePercent}
          disabled={!editable}
          onChange={(event) => setScalePercent(event.target.value)}
          aria-invalid={errors.scaleMinConversion ? "true" : undefined}
        />
        {errors.scaleMinConversion ? <p className="text-sm text-destructive">{errors.scaleMinConversion}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="product-margin"
          type="checkbox"
          name="scaleRequiresPositiveMargin"
          checked={requiresMargin}
          disabled={!editable}
          onChange={(event) => setRequiresMargin(event.target.checked)}
        />
        <Label htmlFor="product-margin">Marge positive exigée pour scaler (produit)</Label>
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

      <div className="flex gap-2">
        <Button type="submit" disabled={savePending || !editable}>
          Enregistrer la surcharge
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={resetPending || !editable}
          onClick={() => resetAction(new FormData())}
        >
          Réinitialiser
        </Button>
      </div>
    </form>
  );
}

// BO-09's `/admin/settings` (specs/BO-09-seuils.md): the studio defaults
// form plus a product picker and that one product's override form. A
// product with no products at all (no product created yet) shows the
// defaults form alone.
export function ThresholdsSettings({ view }: { view: SettingsView }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(view.products[0]?.productId ?? null);
  const selected = view.products.find((product) => product.productId === selectedProductId) ?? null;

  return (
    <div className="grid gap-6">
      <ThresholdsForm defaults={view.defaults.values} products={view.products} editable={view.defaults.editable} />

      <div className="grid gap-4 rounded-md border p-4">
        <h2 className="text-lg font-semibold">Surcharge par produit</h2>
        {view.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun produit à surcharger.</p>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="product-picker">Produit à surcharger</Label>
              <select
                id="product-picker"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={selectedProductId ?? ""}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {view.products.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.name}
                    {product.override ? " (surchargé)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {selected ? (
              <ProductOverrideForm
                key={selected.productId}
                product={selected}
                defaults={view.defaults.values}
                allProducts={view.products}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
