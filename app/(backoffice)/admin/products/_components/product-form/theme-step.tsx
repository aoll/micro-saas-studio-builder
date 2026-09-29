"use client";

import { useTranslations } from "next-intl";
import type { Theme } from "@/lib/dal/themes";
import { ThemeThumbnail } from "@/components/backoffice/theme-thumbnail";

export type ThemePatch = Partial<{ themeId: string }>;

// BO-05 step 2 (docs/02-ecrans.md): a theme picked from base rather than
// designed here (docs/01-produit.md › Thèmes).
export function ThemeStep({
  themes,
  themeId,
  errors,
  onChange,
}: {
  themes: Theme[];
  themeId: string;
  errors: Record<string, string>;
  onChange: (patch: ThemePatch) => void;
}) {
  const t = useTranslations("backoffice-product-form-a");

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
    </div>
  );
}
