"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
  const logoInput = useRef<HTMLInputElement>(null);
  const t = useTranslations("backoffice-product-form-a");

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

  function clearLogo() {
    const { logoUrl: _drop, ...rest } = branding;
    onChange({ branding: rest });
    if (logoInput.current) logoInput.current.value = "";
  }

  function clearColor() {
    const { primaryColor: _drop, ...rest } = branding;
    onChange({ branding: rest });
  }

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={t("themeStep.themeGroupLabel")} className="grid grid-cols-2 gap-3">
        {themes.map((theme) => {
          const checked = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange({ themeId: theme.id })}
              className={`relative rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                checked ? "ring-2 ring-primary" : ""
              }`}
            >
              <ThemeThumbnail tokens={theme.tokens} landingVariant={theme.landingVariant} name={theme.name} />
              {checked ? (
                <span className="absolute top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  {t("themeStep.currentTheme")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {errors.themeId ? <p className="text-sm text-destructive">{errors.themeId}</p> : null}

      <div className="grid gap-1.5">
        <Label htmlFor="product-logo">{t("themeStep.logoLabel")}</Label>
        <input
          id="product-logo"
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {branding.logoUrl ? (
          <div className="flex items-center gap-2">
            <Image src={branding.logoUrl} alt={t("themeStep.logoAlt")} width={64} height={64} unoptimized />
            <Button type="button" variant="ghost" size="sm" onClick={clearLogo}>
              {t("themeStep.clearLogo")}
            </Button>
          </div>
        ) : null}
        {logoError ? <p className="text-sm text-destructive">{logoError}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="product-primary-color">{t("themeStep.colorLabel")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="product-primary-color"
            placeholder="#rrggbb"
            value={branding.primaryColor ?? ""}
            onChange={(event) => onChange({ branding: { ...branding, primaryColor: event.target.value } })}
            aria-invalid={errors["branding.primaryColor"] ? "true" : undefined}
          />
          <Button type="button" variant="ghost" size="sm" onClick={clearColor}>
            {t("themeStep.clearColor")}
          </Button>
        </div>
        {errors["branding.primaryColor"] ? (
          <p className="text-sm text-destructive">{errors["branding.primaryColor"]}</p>
        ) : null}
      </div>
    </div>
  );
}
