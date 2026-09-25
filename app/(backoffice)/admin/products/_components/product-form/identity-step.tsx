"use client";

import type { ProductConfig, ProductStatus } from "@/lib/schemas/product-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "./slugify";

// `lib/schemas/product-config.ts` is a frozen contract (CLAUDE.md): no
// `Locale` type is exported from it, so it is derived here instead of
// widening that file.
type Locale = ProductConfig["locale"];

export type IdentityPatch = Partial<{
  name: string;
  slug: string;
  status: ProductStatus;
  locale: Locale;
  slugEdited: boolean;
}>;

// BO-05 step 1 (docs/02-ecrans.md › BO-05 en détail): the slug is derived
// from the name as the admin types, until they edit the slug field
// directly — `slugEdited` is owned by the parent form (ProductForm) so it
// survives step navigation via `<Activity mode="hidden">` the same way the
// rest of the draft does.
export function IdentityStep({
  mode,
  name,
  slug,
  status,
  locale,
  slugEdited,
  errors,
  onChange,
}: {
  mode: "create" | "edit";
  name: string;
  slug: string;
  status: ProductStatus;
  locale: Locale;
  slugEdited: boolean;
  errors: Record<string, string>;
  onChange: (patch: IdentityPatch) => void;
}) {
  const readOnly = mode === "edit";

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="product-name">Nom</Label>
        <Input
          id="product-name"
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            onChange(slugEdited ? { name: nextName } : { name: nextName, slug: slugify(nextName) });
          }}
          aria-invalid={errors.name ? "true" : undefined}
        />
        {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-slug">Slug</Label>
        <Input
          id="product-slug"
          value={slug}
          disabled={readOnly}
          onChange={(event) => onChange({ slug: event.target.value, slugEdited: true })}
          aria-invalid={errors.slug ? "true" : undefined}
        />
        {errors.slug ? <p className="text-sm text-destructive">{errors.slug}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-status">Statut</Label>
        <select
          id="product-status"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-50"
          value={status}
          disabled={readOnly}
          onChange={(event) => onChange({ status: event.target.value as ProductStatus })}
        >
          <option value="test">Test</option>
          <option value="learn">Learn</option>
          <option value="scale">Scale</option>
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-locale">Langue</Label>
        <select
          id="product-locale"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={locale}
          onChange={(event) => onChange({ locale: event.target.value as Locale })}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
}
