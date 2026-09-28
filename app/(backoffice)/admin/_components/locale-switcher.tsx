"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/components/utils";
import type { ProductConfig } from "@/lib/schemas/product-config";

// docs/08-stack.md › i18n: the cookie i18n/request.ts reads. Duplicated as
// a literal (not imported): a server module can't be imported from a
// 'use client' file (it would pull in server-only code). The E2E journey
// (e2e/backoffice-locale.spec.ts) catches any drift between the two.
const ADMIN_LOCALE_COOKIE = "admin_locale";
const LOCALES: ProductConfig["locale"][] = ["fr", "en"];

function writeLocaleCookie(locale: ProductConfig["locale"]) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ADMIN_LOCALE_COOKIE}=${locale}; path=/admin; max-age=31536000; SameSite=Lax${secure}`;
}

// I18N-BACKOFFICE: an admin picks fr/en manually, never a guess (no
// Accept-Language detection behind auth). Writes the admin_locale cookie
// client-side, then refreshes the current route: the URL never changes and
// the session is untouched, only i18n/request.ts's backoffice branch reads
// a different value on the next render.
export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("backoffice.localeSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: ProductConfig["locale"]) {
    writeLocaleCookie(next);
    startTransition(() => router.refresh());
  }

  return (
    <div role="group" aria-label={t("label")} className="inline-flex gap-1">
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={locale === value}
          disabled={isPending}
          onClick={() => selectLocale(value)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
            locale === value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {t(value)}
        </button>
      ))}
    </div>
  );
}
