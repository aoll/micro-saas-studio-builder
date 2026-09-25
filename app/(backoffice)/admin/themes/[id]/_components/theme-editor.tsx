"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FONT_KEYS } from "@/lib/fonts";
import type { Theme } from "@/lib/dal/themes";
import type { LandingVariant, ThemeTokens } from "@/lib/schemas/theme-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LANDING_VARIANT_LABELS } from "../../_components/landing-variant-labels";
import { saveTheme, type SaveThemeState } from "../_actions";
import { FONT_LABELS } from "./font-labels";
import { radiusToRem, remToRadius } from "./radius";

// The 16 keys of colorTokensSchema (lib/schemas/theme-tokens.ts), in the
// schema's own order (plan's design decision 4). A literal tuple rather
// than `Object.keys(tokens.light)`: the schema is frozen, but a runtime
// key order is not a contract worth depending on.
const COLOR_KEYS = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "border",
  "input",
  "ring",
] as const satisfies readonly (keyof ThemeTokens["light"])[];

function colorLabel(key: string): string {
  const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const words = kebab.split("-");
  return `${words[0]![0]!.toUpperCase()}${words[0]!.slice(1)}${words.length > 1 ? ` ${words.slice(1).join(" ")}` : ""}`;
}

const initialState: SaveThemeState = {};

// BO-08's editor (specs/BO-08-editeur-theme.md, docs/03-maquettes.md ›
// BO-08): stacked `<fieldset>` sections (plan's orchestrator decision 1)
// instead of the mockup's tabs. `theme.id` is bound to `saveTheme` once
// (next/root-params is not available in Server Actions, same reasoning as
// admin/products' `.bind(null, slug)`).
export function ThemeEditor({ theme, readOnly }: { theme: Theme; readOnly: boolean }) {
  const [tokens, setTokens] = useState<ThemeTokens>(theme.tokens);
  const [landingVariant, setLandingVariant] = useState<LandingVariant>(theme.landingVariant);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [state, formAction, pending] = useActionState(saveTheme.bind(null, theme.id), initialState);

  useEffect(() => {
    if (state.ok) toast.success("Thème enregistré");
    if (state.formError) toast.error(state.formError);
  }, [state]);

  const errors = state.errors ?? {};
  const hasErrors = Object.keys(errors).length > 0;

  function updateColor(key: (typeof COLOR_KEYS)[number], value: string) {
    setTokens((current) => ({ ...current, [mode]: { ...current[mode], [key]: value } }));
  }

  const payload = JSON.stringify({ tokens, landingVariant });

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="payload" value={payload} readOnly />

      {hasErrors ? (
        <p role="alert" className="text-sm text-destructive">
          Ce thème contient des erreurs.
        </p>
      ) : null}

      <fieldset disabled={readOnly} className="grid gap-6">
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">Couleurs</legend>
          <div role="group" aria-label="Mode" className="flex w-fit gap-1 rounded-md border p-1">
            <button
              type="button"
              aria-pressed={mode === "light"}
              className="rounded px-2 py-1 text-sm aria-pressed:bg-secondary"
              onClick={() => setMode("light")}
            >
              Clair
            </button>
            <button
              type="button"
              aria-pressed={mode === "dark"}
              className="rounded px-2 py-1 text-sm aria-pressed:bg-secondary"
              onClick={() => setMode("dark")}
            >
              Sombre
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {COLOR_KEYS.map((key) => {
              const value = tokens[mode][key];
              const path = `tokens.${mode}.${key}`;
              const fieldId = `theme-color-${mode}-${key}`;
              return (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={fieldId}>{colorLabel(key)}</Label>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-6 shrink-0 rounded border"
                      style={{ backgroundColor: /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "transparent" }}
                    />
                    <Input
                      id={fieldId}
                      value={value}
                      disabled={readOnly}
                      aria-invalid={path in errors}
                      onChange={(event) => updateColor(key, event.target.value)}
                    />
                  </div>
                  {errors[path] ? <p className="text-sm text-destructive">{errors[path]}</p> : null}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-semibold">Typographie</legend>
          <Label htmlFor="theme-font-key">Police</Label>
          <select
            id="theme-font-key"
            className="w-fit rounded-md border bg-background px-3 py-2 text-sm"
            value={tokens.fontKey}
            disabled={readOnly}
            aria-invalid={"tokens.fontKey" in errors}
            onChange={(event) => setTokens((current) => ({ ...current, fontKey: event.target.value }))}
          >
            {FONT_KEYS.map((key) => (
              <option key={key} value={key}>
                {FONT_LABELS[key]}
              </option>
            ))}
          </select>
          {errors["tokens.fontKey"] ? <p className="text-sm text-destructive">{errors["tokens.fontKey"]}</p> : null}
        </fieldset>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-semibold">Forme</legend>
          <Label htmlFor="theme-radius">Radius</Label>
          <div className="flex items-center gap-3">
            <input
              id="theme-radius"
              type="range"
              min={0}
              max={2}
              step={0.125}
              value={radiusToRem(tokens.radius)}
              disabled={readOnly}
              aria-invalid={"tokens.radius" in errors}
              onChange={(event) =>
                setTokens((current) => ({ ...current, radius: remToRadius(Number(event.target.value)) }))
              }
            />
            <span className="text-sm text-muted-foreground">{tokens.radius}</span>
          </div>
          {errors["tokens.radius"] ? <p className="text-sm text-destructive">{errors["tokens.radius"]}</p> : null}
        </fieldset>

        <fieldset className="grid gap-1.5">
          <legend className="text-sm font-semibold">Landing</legend>
          <Label htmlFor="theme-landing-variant">Variante de landing</Label>
          <select
            id="theme-landing-variant"
            className="w-fit rounded-md border bg-background px-3 py-2 text-sm"
            value={landingVariant}
            disabled={readOnly}
            aria-invalid={"landingVariant" in errors}
            onChange={(event) => setLandingVariant(event.target.value as LandingVariant)}
          >
            {Object.entries(LANDING_VARIANT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.landingVariant ? <p className="text-sm text-destructive">{errors.landingVariant}</p> : null}
        </fieldset>
      </fieldset>

      <div className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href={"/admin/themes" as Route}>Annuler</Link>
        </Button>
        <Button type="submit" disabled={pending || readOnly}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
