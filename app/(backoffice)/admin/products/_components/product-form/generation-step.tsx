"use client";

import { useRef } from "react";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { templateVariables } from "@/lib/schemas/product-config";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/utils";
import { insertVariable } from "./prompt-variables";

export type GenerationPatch = Partial<ProductConfig["generation"]>;

type Generation = ProductConfig["generation"];

// Claude Haiku 4.5 is the demo's default model, Sonnet 5 its "premium" step
// up (docs/05-ia.md); the plan's orchestrator decision 8: a stored model
// that is neither is kept as a third option, rather than silently replaced.
const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { value: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
];

function modelOptions(current: string) {
  if (MODEL_OPTIONS.some((option) => option.value === current)) return MODEL_OPTIONS;
  return [...MODEL_OPTIONS, { value: current, label: current }];
}

// BO-05 step 5 (docs/02-ecrans.md): model, prompt template with clickable
// {{variables}}, output type. The unknown-variable check runs live on every
// render (not only after a save), on top of whatever the server/step
// validation already reported in `errors`.
export function GenerationStep({
  generation,
  inputs,
  errors,
  onChange,
}: {
  generation: Generation;
  inputs: { key: string }[];
  errors: Record<string, string>;
  onChange: (patch: GenerationPatch) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fieldKeys = new Set(inputs.map((input) => input.key));
  const unknownVariables = templateVariables(generation.promptTemplate).filter((variable) => !fieldKeys.has(variable));
  const liveError = unknownVariables[0] ? `Variable {{${unknownVariables[0]}}} sans champ correspondant` : undefined;
  const templateError = errors["generation.promptTemplate"] ?? liveError;

  function insertChip(key: string) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? generation.promptTemplate.length;
    const end = textarea?.selectionEnd ?? generation.promptTemplate.length;
    const { value } = insertVariable(generation.promptTemplate, start, end, key);
    onChange({ promptTemplate: value });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="generation-model">Modèle</Label>
        <select
          id="generation-model"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={generation.model}
          onChange={(event) => onChange({ model: event.target.value })}
        >
          {modelOptions(generation.model).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="generation-prompt-template">Template de prompt</Label>
        {inputs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {inputs.map((input) => (
              <button
                key={input.key}
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => insertChip(input.key)}
              >
                {`{{${input.key}}}`}
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          id="generation-prompt-template"
          ref={textareaRef}
          rows={4}
          value={generation.promptTemplate}
          onChange={(event) => onChange({ promptTemplate: event.target.value })}
          aria-invalid={templateError ? "true" : undefined}
        />
        {templateError ? <p className="text-sm text-destructive">{templateError}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Type de sortie</span>
        <div role="radiogroup" aria-label="Type de sortie" className="flex gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={generation.outputType === "markdown"}
            onClick={() => onChange({ outputType: "markdown" })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              generation.outputType === "markdown" ? "border-primary bg-accent" : "hover:bg-muted",
            )}
          >
            Markdown
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={false}
            disabled
            title="Bientôt disponible"
            className="cursor-not-allowed rounded-md border px-3 py-1.5 text-sm opacity-50"
          >
            Image (bientôt)
          </button>
        </div>
      </div>
    </div>
  );
}
