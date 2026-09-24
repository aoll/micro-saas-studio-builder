import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

// docs/02-ecrans.md › Header produit: logo, name, balance badge, account
// menu (account menu itself is SA-07's). The logo/name links back to the
// product's landing.
export function ProductHeader({
  slug,
  name,
  logoUrl,
  balance,
}: {
  slug: string;
  name: string;
  logoUrl?: string;
  balance: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <Link href={`/${slug}`} className="flex items-center gap-2">
        {logoUrl ? <Image src={logoUrl} alt={name} width={32} height={32} unoptimized className="rounded" /> : null}
        <p className="font-semibold">{name}</p>
      </Link>
      {balance}
    </header>
  );
}
