"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Output = { kind: "markdown"; text: string } | { kind: "image"; url: string; alt: string };

// docs/02-ecrans.md › Carte de résultat: markdown or image, copy /
// download / regenerate. Markdown is shown as plain pre-wrapped text, not
// rendered HTML (docs/05-ia.md: the output is user/AI-generated, never
// trusted as markup).
export function ResultCard({
  output,
  fileName,
  onRegenerate,
  streaming,
}: {
  output: Output;
  fileName: string;
  onRegenerate?: () => void;
  streaming?: boolean;
}) {
  const t = useTranslations("common.result");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (output.kind !== "markdown") return;
    try {
      await navigator.clipboard.writeText(output.text);
      setCopied(true);
    } catch (error) {
      // Never swallowed: the user needs to know the copy failed
      // (CLAUDE.md: no silent failure).
      toast.error(t("copyError"));
      console.error("[ResultCard] clipboard write failed", error);
    }
  }

  function handleDownload(event: React.MouseEvent) {
    event.preventDefault();
    if (output.kind !== "markdown") return;
    const blob = new Blob([output.text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardContent aria-live="polite" className="grid gap-4">
        {output.kind === "markdown" ? (
          <p className="whitespace-pre-wrap">{output.text}</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- generated result, no next/image optimization needed here
          <img src={output.url} alt={output.alt} />
        )}
        <div className="flex gap-2">
          {output.kind === "markdown" ? (
            <>
              <Button type="button" variant="outline" onClick={handleCopy} disabled={streaming}>
                {copied ? t("copied") : t("copy")}
              </Button>
              <Button asChild variant="outline">
                {}
                <a role="link" onClick={handleDownload} download={`${fileName}.md`} href="#">
                  {t("download")}
                </a>
              </Button>
            </>
          ) : null}
          {onRegenerate ? (
            <Button type="button" variant="outline" onClick={onRegenerate} disabled={streaming}>
              {t("regenerate")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
