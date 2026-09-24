import "@/app/globals.css";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/backoffice/admin-sidebar";
import { Toaster } from "@/components/ui/sonner";

// Root layout for the whole backoffice (docs/09-arborescence.md), including
// /admin/login: AdminSidebar renders null there (no session yet), never a
// redirect loop.
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-dvh">
        <Suspense fallback={null}>
          <AdminSidebar />
        </Suspense>
        <div className="flex-1">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
