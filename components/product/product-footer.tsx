import type { Route } from "next";
import { useTranslations } from "next-intl";
import Link from "next/link";

// docs/02-ecrans.md › Footer produit: name + link to the studio's other
// products. No `new Date()`: a copyright year would make this component
// (and the statically pre-rendered landing that includes it) dynamic
// (docs/04-nextjs.md, risks table).
export function ProductFooter({ name }: { name: string }) {
  const t = useTranslations("common.footer");
  return (
    <footer className="border-t px-4 py-6 text-sm text-muted-foreground">
      <p>{name}</p>
      {/* The studio's own listing page is out of this spec's scope: cast dropped once it exists. */}
      <Link href={"/" as Route}>{t("studioLink")}</Link>
    </footer>
  );
}
