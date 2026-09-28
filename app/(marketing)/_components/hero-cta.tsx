"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Hero's primary CTA is a plain `href="#produits"` link (Hero itself stays a
// server component shipping no JS). A browser only scrolls to a fragment
// when the URL's hash actually changes: coming back from a product page
// (SA-08/showcase card) restores `/#produits` from history — so a second
// click, with the hash already unchanged, is a native no-op and the CTA
// looks dead. This one-off client leaf scrolls unconditionally on every
// click, on top of (not instead of) the plain href, which still gives a
// no-JS fallback and a real link for crawlers/right-click.
export function HeroCta({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Link
      href="#produits"
      className={className}
      onClick={() => document.getElementById("produits")?.scrollIntoView({ behavior: "smooth", block: "start" })}
    >
      {children}
    </Link>
  );
}
