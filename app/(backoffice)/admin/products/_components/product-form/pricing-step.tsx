"use client";

import type { Pack } from "@/lib/schemas/pack";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/utils";
import { formatEur, formatUsd, type PackMargin } from "./margin";

type Pricing = ProductConfig["pricing"];

function centsToEuroInput(cents: number): string {
  return (cents / 100).toString();
}

function euroInputToCents(value: string): number {
  return Math.round(Number.parseFloat(value || "0") * 100);
}

// BO-05 step 6 (docs/02-ecrans.md): crédits offerts, coût par génération,
// packs (édition, ajout, suppression, « recommandé »), et la marge
// estimée par pack — mesurée après un « Tester le prompt » réussi, sinon
// l'estimation de référence (`costSource`, lifted from ProductForm).
export function PricingStep({
  pricing,
  margins,
  costSource,
  errors,
  onChange,
}: {
  pricing: Pricing;
  margins: PackMargin[];
  costSource: "measured" | "estimated";
  errors: Record<string, string>;
  onChange: (patch: Partial<Pricing>) => void;
}) {
  function updatePack(index: number, patch: Partial<Pack>) {
    onChange({ packs: pricing.packs.map((pack, i) => (i === index ? { ...pack, ...patch } : pack)) });
  }

  function removePack(index: number) {
    onChange({ packs: pricing.packs.filter((_pack, i) => i !== index) });
  }

  function addPack() {
    onChange({
      packs: [...pricing.packs, { id: `pack-${crypto.randomUUID().slice(0, 8)}`, credits: 10, priceCents: 490 }],
    });
  }

  const marginByPackId = new Map(margins.map((margin) => [margin.packId, margin]));
  const sourceLabel = costSource === "measured" ? "coût mesuré" : "coût estimé";

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pricing-free-credits">Crédits offerts à l&apos;inscription</Label>
          <Input
            id="pricing-free-credits"
            type="number"
            min={0}
            value={pricing.freeCreditsOnSignup}
            onChange={(event) => onChange({ freeCreditsOnSignup: Number(event.target.value) })}
            aria-invalid={errors["pricing.freeCreditsOnSignup"] ? "true" : undefined}
          />
          {errors["pricing.freeCreditsOnSignup"] ? (
            <p className="text-sm text-destructive">{errors["pricing.freeCreditsOnSignup"]}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pricing-anonymous-generations">Générations anonymes gratuites</Label>
          <Input
            id="pricing-anonymous-generations"
            type="number"
            min={0}
            value={pricing.anonymousFreeGenerations}
            onChange={(event) => onChange({ anonymousFreeGenerations: Number(event.target.value) })}
            aria-invalid={errors["pricing.anonymousFreeGenerations"] ? "true" : undefined}
          />
          {errors["pricing.anonymousFreeGenerations"] ? (
            <p className="text-sm text-destructive">{errors["pricing.anonymousFreeGenerations"]}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pricing-cost-per-generation">Coût par génération (crédits)</Label>
          <Input
            id="pricing-cost-per-generation"
            type="number"
            min={1}
            value={pricing.costPerGeneration}
            onChange={(event) => onChange({ costPerGeneration: Number(event.target.value) })}
            aria-invalid={errors["pricing.costPerGeneration"] ? "true" : undefined}
          />
          {errors["pricing.costPerGeneration"] ? (
            <p className="text-sm text-destructive">{errors["pricing.costPerGeneration"]}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Packs de crédits</span>
          <Button type="button" variant="outline" size="sm" onClick={addPack}>
            Ajouter un pack
          </Button>
        </div>
        {errors["pricing.packs"] ? <p className="text-sm text-destructive">{errors["pricing.packs"]}</p> : null}
        <p className="text-xs text-muted-foreground">Marge par génération estimée à partir d&apos;un {sourceLabel}.</p>

        {pricing.packs.map((pack, index) => {
          const margin = marginByPackId.get(pack.id);
          // QA1-P6-E3 (B-P6-1): a pack with 0 credits (or another value that
          // makes the margin non-finite) shows "—" instead of "$Infinity" or
          // "$NaN" while the field itself is invalid.
          const marginValid = margin !== undefined && Number.isFinite(margin.marginMicros);
          const negative = marginValid && margin.marginMicros < 0;
          return (
            <div key={index} className="grid gap-2 rounded-md border p-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`pricing-pack-credits-${index}`}>Crédits</Label>
                  <Input
                    id={`pricing-pack-credits-${index}`}
                    type="number"
                    min={1}
                    value={pack.credits}
                    onChange={(event) => updatePack(index, { credits: Number(event.target.value) })}
                    aria-invalid={errors[`pricing.packs.${index}.credits`] ? "true" : undefined}
                  />
                  {errors[`pricing.packs.${index}.credits`] ? (
                    <p className="text-sm text-destructive">{errors[`pricing.packs.${index}.credits`]}</p>
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`pricing-pack-price-${index}`}>Prix (€)</Label>
                  <Input
                    id={`pricing-pack-price-${index}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={centsToEuroInput(pack.priceCents)}
                    onChange={(event) => updatePack(index, { priceCents: euroInputToCents(event.target.value) })}
                    aria-invalid={errors[`pricing.packs.${index}.priceCents`] ? "true" : undefined}
                  />
                  {errors[`pricing.packs.${index}.priceCents`] ? (
                    <p className="text-sm text-destructive">{errors[`pricing.packs.${index}.priceCents`]}</p>
                  ) : null}
                </div>
                <div className="flex items-end gap-2">
                  <input
                    id={`pricing-pack-recommended-${index}`}
                    type="checkbox"
                    checked={pack.recommended ?? false}
                    onChange={(event) => updatePack(index, { recommended: event.target.checked })}
                  />
                  <Label htmlFor={`pricing-pack-recommended-${index}`}>Recommandé</Label>
                </div>
              </div>
              {errors[`pricing.packs.${index}.id`] ? (
                <p className="text-sm text-destructive">{errors[`pricing.packs.${index}.id`]}</p>
              ) : null}

              {margin ? (
                <p data-testid="pack-margin" className={cn("text-sm", negative && "text-destructive")}>
                  {formatEur(pack.priceCents)} · marge {marginValid ? formatUsd(margin.marginMicros) : "—"} par
                  génération
                </p>
              ) : null}

              <Button type="button" variant="ghost" size="sm" onClick={() => removePack(index)}>
                Supprimer ce pack
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
