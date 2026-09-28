"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/components/utils";

// BO-05's 7 steps (docs/02-ecrans.md › BO-05 en détail). `titleKey` indexes
// `backoffice-product-form-b1.stepNav.steps` (messages/{fr,en}/…): the
// displayed title is resolved inside StepNav itself, not stored here, so it
// follows the admin's chosen backoffice locale (I18N-BACKOFFICE-STRINGS).
export const STEPS: { step: number; titleKey: string }[] = [
  { step: 1, titleKey: "identity" },
  { step: 2, titleKey: "theme" },
  { step: 3, titleKey: "landing" },
  { step: 4, titleKey: "fields" },
  { step: 5, titleKey: "generation" },
  { step: 6, titleKey: "pricing" },
  { step: 7, titleKey: "summary" },
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
  const t = useTranslations("backoffice-product-form-b1.stepNav");

  return (
    <nav aria-label={t("ariaLabel")}>
      <ol className="grid gap-1">
        {STEPS.map(({ step, titleKey }) => (
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
              {`${step}. ${t(`steps.${titleKey}`)}`}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
