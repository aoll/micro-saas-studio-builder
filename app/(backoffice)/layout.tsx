import "@/app/globals.css";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/backoffice/admin-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { display, mono, sans } from "@/components/brand/fonts";

// Root layout for the whole backoffice (docs/09-arborescence.md), including
// /admin/login: AdminSidebar renders null there (no session yet), never a
// redirect loop. `mk-theme` gives it the studio's "bleu diffus" look
// (app/globals.css), the same as the landing.
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`mk-theme ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh mk-backdrop text-foreground">
        <Suspense fallback={null}>
          <AdminSidebar />
        </Suspense>
        <div className="flex-1">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
