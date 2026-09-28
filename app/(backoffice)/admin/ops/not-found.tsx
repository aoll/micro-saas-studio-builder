import type { Metadata } from "next";
import { useTranslations } from "next-intl";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// QA1-P1-B12: rendered inside the backoffice root layout (which already
// provides <html lang="fr"><body>, app/(backoffice)/layout.tsx) whenever
// ops/page.tsx's own owner check calls notFound() — a signed-in, non-owner
// session (proxy.ts's optimistic guard only 404s the cookie-less case,
// before any page runs). Same wording as proxy.ts's NOT_FOUND_HTML, no link
// to /admin: this owner-only page stays "cachée" even in its error state.
// I18N-BACKOFFICE-STRINGS: a plain Server Component, kept non-async (like
// demo-banner.tsx): `useTranslations` from "next-intl" resolves
// synchronously against the ambient per-request config.
export default function OpsNotFound() {
  const t = useTranslations("backoffice-portfolio");
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("ops.notFoundTitle")}</h1>
    </main>
  );
}
