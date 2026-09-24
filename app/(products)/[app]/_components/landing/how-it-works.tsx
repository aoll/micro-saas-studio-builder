import { useTranslations } from "next-intl";

// SA-01: "comment ça marche" section (docs/02-ecrans.md). Numbered circles,
// `bg-primary text-primary-foreground` (plan design decision 4).
export function HowItWorks({ steps }: { steps: { title: string; description: string }[] | undefined }) {
  const t = useTranslations("landing");
  if (!steps || steps.length === 0) return null;

  return (
    <div>
      <p className="font-medium">{t("steps.title")}</p>
      <ol className="mt-4 grid gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
