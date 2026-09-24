import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// SA-01: "exemple de résultat" section (docs/02-ecrans.md). Empty or
// missing config renders nothing rather than an empty section.
export function ExampleResult({ exampleOutput }: { exampleOutput: string | undefined }) {
  const t = useTranslations("landing");
  if (!exampleOutput || exampleOutput.trim() === "") return null;

  return (
    <Card>
      <CardHeader>
        <p className="font-medium">{t("example.title")}</p>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-muted-foreground">{exampleOutput}</p>
      </CardContent>
    </Card>
  );
}
