"use client";

import Image from "next/image";
import { useState } from "react";
import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeThumbnail } from "@/components/backoffice/theme-thumbnail";

export type ThemePatch = Partial<{ themeId: string; branding: ProductConfig["branding"] }>;

// BO-05 step 2 (docs/02-ecrans.md): a theme picked from base rather than
// designed here (docs/01-produit.md › Thèmes). `onUploadLogo` is injected
// by ProductForm (a thin wrapper around the `uploadLogo` Server Action) so
// this leaf stays a plain controlled component in tests.
export function ThemeStep({
  themes,
  themeId,
  branding,
  errors,
  onChange,
  onUploadLogo,
}: {
  themes: Theme[];
  themeId: string;
  branding: ProductConfig["branding"];
  errors: Record<string, string>;
  onChange: (patch: ThemePatch) => void;
  onUploadLogo: (file: File) => Promise<{ url?: string; error?: string }>;
}) {
  const [logoError, setLogoError] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setLogoError(undefined);
    const result = await onUploadLogo(file);
    setUploading(false);
    if (result.error) {
      setLogoError(result.error);
      return;
    }
    if (result.url) onChange({ branding: { ...branding, logoUrl: result.url } });
  }

  function clearColor() {
    const { primaryColor: _drop, ...rest } = branding;
    onChange({ branding: rest });
  }

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Thème" className="grid grid-cols-2 gap-3">
        {themes.map((theme) => {
          const checked = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange({ themeId: theme.id })}
              className="rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ThemeThumbnail tokens={theme.tokens} landingVariant={theme.landingVariant} name={theme.name} />
            </button>
          );
        })}
      </div>
      {errors.themeId ? <p className="text-sm text-destructive">{errors.themeId}</p> : null}

      <div className="grid gap-1.5">
        <Label htmlFor="product-logo">Logo</Label>
        <input
          id="product-logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {branding.logoUrl ? (
          <Image src={branding.logoUrl} alt="Logo du produit" width={64} height={64} unoptimized />
        ) : null}
        {logoError ? <p className="text-sm text-destructive">{logoError}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-primary-color">Couleur du thème</Label>
        <div className="flex items-center gap-2">
          <Input
            id="product-primary-color"
            placeholder="#rrggbb"
            value={branding.primaryColor ?? ""}
            onChange={(event) => onChange({ branding: { ...branding, primaryColor: event.target.value } })}
            aria-invalid={errors["branding.primaryColor"] ? "true" : undefined}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearColor}>
            Effacer la couleur
          </Button>
        </div>
        {errors["branding.primaryColor"] ? (
          <p className="text-sm text-destructive">{errors["branding.primaryColor"]}</p>
        ) : null}
      </div>
    </div>
  );
}
