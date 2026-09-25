import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// QA1-P1-B12: rendered inside the backoffice root layout (which already
// provides <html lang="fr"><body>, app/(backoffice)/layout.tsx) whenever
// ops/page.tsx's own owner check calls notFound() — a signed-in, non-owner
// session (proxy.ts's optimistic guard only 404s the cookie-less case,
// before any page runs). Same wording as proxy.ts's NOT_FOUND_HTML, no link
// to /admin: this owner-only page stays "cachée" even in its error state.
export default function OpsNotFound() {
  return (
    <main className="mx-auto grid max-w-xl gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
    </main>
  );
}
