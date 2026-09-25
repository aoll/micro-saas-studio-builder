import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// SA-01: "exemple de résultat" section (docs/02-ecrans.md). Empty or
// missing config renders nothing rather than an empty section. `bare`
// drops the card chrome for a plain blockquote (the minimal variant,
// docs/03-maquettes.md).
export function ExampleResult({ exampleOutput, bare = false }: { exampleOutput: string | undefined; bare?: boolean }) {
  const t = useTranslations("landing");
  if (!exampleOutput || exampleOutput.trim() === "") return null;

  const title = <h2 className="font-medium">{t("example.title")}</h2>;
  const text = <p className="whitespace-pre-line text-muted-foreground">{exampleOutput}</p>;

  if (bare) {
    return (
      <div>
        {title}
        <blockquote className="mt-2 border-l-2 pl-4">{text}</blockquote>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardContent>{text}</CardContent>
    </Card>
  );
}
