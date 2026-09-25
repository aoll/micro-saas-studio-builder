"use client";

import type { ProductConfig } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/utils";
import { moveItem } from "./form-values";

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

type Landing = ProductConfig["landing"];
type LandingStepEntry = NonNullable<Landing["steps"]>[number];

function CharCounter({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <p aria-live="polite" className={cn("text-xs text-muted-foreground", over && "text-destructive")}>
      {value.length} / {max}
    </p>
  );
}

// BO-05 step 3 (docs/02-ecrans.md): titles, an editable FAQ list, and SEO
// meta with live character counters.
export function LandingStep({
  landing,
  errors,
  onChange,
}: {
  landing: Landing;
  errors: Record<string, string>;
  onChange: (patch: Partial<Landing>) => void;
}) {
  function updateFaqEntry(index: number, patch: Partial<Landing["faq"][number]>) {
    onChange({ faq: landing.faq.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
  }

  function removeFaqEntry(index: number) {
    onChange({ faq: landing.faq.filter((_entry, i) => i !== index) });
  }

  const steps = landing.steps ?? [];

  function updateStep(index: number, patch: Partial<LandingStepEntry>) {
    onChange({ steps: steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) });
  }

  function addStep() {
    onChange({ steps: [...steps, { title: "", description: "" }] });
  }

  function removeStep(index: number) {
    onChange({ steps: steps.filter((_step, i) => i !== index) });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="landing-headline">Titre</Label>
        <Input
          id="landing-headline"
          value={landing.headline}
          onChange={(event) => onChange({ headline: event.target.value })}
          aria-invalid={errors["landing.headline"] ? "true" : undefined}
        />
        {errors["landing.headline"] ? <p className="text-sm text-destructive">{errors["landing.headline"]}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="landing-subheadline">Sous-titre</Label>
        <Input
          id="landing-subheadline"
          value={landing.subheadline}
          onChange={(event) => onChange({ subheadline: event.target.value })}
          aria-invalid={errors["landing.subheadline"] ? "true" : undefined}
        />
        {errors["landing.subheadline"] ? (
          <p className="text-sm text-destructive">{errors["landing.subheadline"]}</p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="landing-example-output">Exemple de résultat</Label>
        <Textarea
          id="landing-example-output"
          value={landing.exampleOutput ?? ""}
          onChange={(event) => onChange({ exampleOutput: event.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Comment ça marche</span>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            Ajouter une étape
          </Button>
        </div>
        {steps.map((step, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`landing-step-title-${index}`}>{`Titre de l'étape ${index + 1}`}</Label>
              <Input
                id={`landing-step-title-${index}`}
                value={step.title}
                onChange={(event) => updateStep(index, { title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`landing-step-description-${index}`}>{`Description de l'étape ${index + 1}`}</Label>
              <Textarea
                id={`landing-step-description-${index}`}
                value={step.description}
                onChange={(event) => updateStep(index, { description: event.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index === 0}
                onClick={() => onChange({ steps: moveItem(steps, index, "up") })}
              >
                Monter
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={index === steps.length - 1}
                onClick={() => onChange({ steps: moveItem(steps, index, "down") })}
              >
                Descendre
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                Supprimer cette étape
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">FAQ</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ faq: [...landing.faq, { question: "", answer: "" }] })}
          >
            Ajouter une question
          </Button>
        </div>
        {landing.faq.map((entry, index) => (
          <div key={index} className="grid gap-2 rounded-md border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`faq-question-${index}`}>Question</Label>
              <Input
                id={`faq-question-${index}`}
                value={entry.question}
                onChange={(event) => updateFaqEntry(index, { question: event.target.value })}
                aria-invalid={errors[`landing.faq.${index}.question`] ? "true" : undefined}
              />
              {errors[`landing.faq.${index}.question`] ? (
                <p className="text-sm text-destructive">{errors[`landing.faq.${index}.question`]}</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`faq-answer-${index}`}>Réponse</Label>
              <Textarea
                id={`faq-answer-${index}`}
                value={entry.answer}
                onChange={(event) => updateFaqEntry(index, { answer: event.target.value })}
                aria-invalid={errors[`landing.faq.${index}.answer`] ? "true" : undefined}
              />
              {errors[`landing.faq.${index}.answer`] ? (
                <p className="text-sm text-destructive">{errors[`landing.faq.${index}.answer`]}</p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeFaqEntry(index)}>
              Supprimer cette question
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="landing-seo-title">Titre SEO</Label>
        <Input
          id="landing-seo-title"
          value={landing.seoTitle}
          onChange={(event) => onChange({ seoTitle: event.target.value })}
          aria-invalid={errors["landing.seoTitle"] ? "true" : undefined}
        />
        <CharCounter value={landing.seoTitle} max={SEO_TITLE_MAX} />
        {errors["landing.seoTitle"] ? <p className="text-sm text-destructive">{errors["landing.seoTitle"]}</p> : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="landing-seo-description">Description SEO</Label>
        <Textarea
          id="landing-seo-description"
          value={landing.seoDescription}
          onChange={(event) => onChange({ seoDescription: event.target.value })}
          aria-invalid={errors["landing.seoDescription"] ? "true" : undefined}
        />
        <CharCounter value={landing.seoDescription} max={SEO_DESCRIPTION_MAX} />
        {errors["landing.seoDescription"] ? (
          <p className="text-sm text-destructive">{errors["landing.seoDescription"]}</p>
        ) : null}
      </div>
    </div>
  );
}
