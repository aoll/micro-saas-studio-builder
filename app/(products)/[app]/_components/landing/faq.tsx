import { useTranslations } from "next-intl";

// SA-01: FAQ section, native <details>/<summary> so it needs no JavaScript
// (docs/04-nextjs.md › Rendu et expérience front).
export function Faq({ entries }: { entries: { question: string; answer: string }[] }) {
  const t = useTranslations("landing");
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="font-medium">{t("faq.title")}</p>
      <div className="mt-4 grid gap-2">
        {entries.map((entry) => (
          <details key={entry.question} className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">{entry.question}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{entry.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
