import "@/app/globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/backoffice/admin-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { display, mono, sans } from "@/components/brand/fonts";
import { LocaleSwitcher } from "./admin/_components/locale-switcher";

// I18N-BACKOFFICE (docs/08-stack.md › i18n): the admin_locale cookie, read
// through i18n/request.ts's single getRequestConfig entry point, makes
// this layout request-bound (Cache Components' static-shell check flags a
// cookie read in a root layout). `instant = false` is the documented
// opt-out (next/dist/docs/.../migrating-to-cache-components.md): scoped to
// this root layout's own subtree, the [app] and (marketing) groups keep
// their own prerendering untouched. Spiked with a throwaway `pnpm build`
// (I18N-BACKOFFICE plan, phase 0) before writing this.
export const instant = false;

// Root layout for the whole backoffice (docs/09-arborescence.md), including
// /admin/login: AdminSidebar renders null there (no session yet), never a
// redirect loop. `mk-theme` gives it the studio's "bleu diffus" look
// (app/globals.css), the same as the landing. `<html lang>` and the
// messages come from i18n/request.ts's backoffice branch (the admin_locale
// cookie, fr by default): the same single entry point every other root
// layout in the app already goes through.
export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  // I18N-BACKOFFICE-STRINGS: every backoffice-* zone (one per lot, split so
  // parallel agents never touch the same messages file) goes to the client
  // alongside the original `backoffice` zone; product and marketing zones
  // still never reach this provider.
  const clientMessages = Object.fromEntries(
    Object.entries(messages).filter(([namespace]) => namespace.startsWith("backoffice")),
  );

  return (
    <html lang={locale} className={`mk-theme ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex h-dvh overflow-hidden mk-backdrop text-foreground">
        <NextIntlClientProvider locale={locale} messages={clientMessages}>
          <Suspense fallback={null}>
            <AdminSidebar />
          </Suspense>
          <div className="flex-1 overflow-y-auto">
            <div className="flex justify-end px-6 pt-4">
              <LocaleSwitcher />
            </div>
            {children}
          </div>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
