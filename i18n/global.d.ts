import type { marketingRouting } from "./marketing-routing";

// I18N-BACKOFFICE-STRINGS follow-up (code-reviewer, non-blocking): the app has a single
// fr/en locale set everywhere (marketingRouting.locales, lib/schemas/product-config.ts's
// localeSchema, the backoffice's admin_locale cookie) — this augmentation makes
// useLocale()/getLocale() return "fr" | "en" directly, so call sites no longer need their
// own `as "fr" | "en"` cast. Ambient (no export), picked up by tsconfig's `**/*.ts` include.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof marketingRouting.locales)[number];
  }
}
