import "@/app/globals.css";
import type { Metadata } from "next";
import { env } from "@/lib/env";

// Root layout for `/`: a third root layout alongside `(backoffice)` and
// `(products)/[app]` (docs/09-arborescence.md's "multiple root layouts"
// case) — this page has neither the backoffice's session-gated UI nor a
// product's theme, so it gets its own minimal shell. `metadataBase` follows
// the same pattern as `(products)/[app]/layout.tsx` and app/sitemap.ts: one
// base URL for every relative metadata field.
export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL),
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}
