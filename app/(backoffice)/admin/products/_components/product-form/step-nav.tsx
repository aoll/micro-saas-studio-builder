"use client";

import { cn } from "@/components/utils";

// BO-05's 7 steps (docs/02-ecrans.md › BO-05 en détail). BO-05a only builds
// steps 1-4; BO-05b appends "Génération", "Pricing" and "Récapitulatif"
// here once it lands (the plan's PR handoff note).
export const STEPS: { step: number; title: string }[] = [
  { step: 1, title: "Identité" },
  { step: 2, title: "Thème" },
  { step: 3, title: "Landing & SEO" },
  { step: 4, title: "Champs de l'outil" },
];

export function StepNav({
  current,
  onSelect,
  stepErrors,
}: {
  current: number;
  onSelect: (step: number) => void;
  stepErrors: Record<number, boolean>;
}) {
  return (
    <nav aria-label="Étapes du formulaire">
      <ol className="grid gap-1">
        {STEPS.map(({ step, title }) => (
          <li key={step}>
            <button
              type="button"
              aria-current={step === current ? "step" : undefined}
              data-has-error={stepErrors[step] ? "true" : undefined}
              onClick={() => onSelect(step)}
              className={cn(
                "w-full rounded-md px-3 py-2 text-left text-sm",
                step === current ? "bg-accent font-medium" : "hover:bg-muted",
                stepErrors[step] && "text-destructive",
              )}
            >
              {`${step}. ${title}`}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
