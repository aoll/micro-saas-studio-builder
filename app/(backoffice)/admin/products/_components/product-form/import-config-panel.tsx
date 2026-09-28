"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseImportedConfig } from "./import-config";

// QA1-P1-M1: step 1's "config prête à coller" panel (docs/01-produit.md ›
// BioInsta's live-demo script). Pure leaf: parses and validates on click,
// then hands the result up through `onImport`/`onErrors` — `ProductForm`
// owns the resulting state (draft, errors, toasts), same pattern as
// `ThemeStep`'s injected `onUploadLogo`.
export function ImportConfigPanel({
  themes,
  currentThemeId,
  onImport,
  onErrors,
}: {
  themes: Theme[];
  currentThemeId: string;
  onImport: (config: ProductConfig) => void;
  onErrors: (errors: Record<string, string>) => void;
}) {
  const [raw, setRaw] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const t = useTranslations("backoffice-product-form-a");
  const tValidation = useTranslations("backoffice-product-form-b2");

  function handleImport() {
    const result = parseImportedConfig(raw, themes, currentThemeId, tValidation);
    if (result.ok) {
      setFormError(undefined);
      onImport(result.config);
      return;
    }
    if ("formError" in result) {
      // `result.formError` is a stable code ("malformed_json"), not a
      // message (import-config.ts): translated here, the one place this
      // panel actually renders it.
      setFormError(t("importPanel.malformedJson"));
      return;
    }
    setFormError(undefined);
    onErrors(result.errors);
  }

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <Label htmlFor="import-config-textarea">{t("importPanel.pasteLabel")}</Label>
      <Textarea
        id="import-config-textarea"
        rows={4}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        placeholder='{ "slug": "bio-instagram", … }'
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleImport}>
          {t("importPanel.importButton")}
        </Button>
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
