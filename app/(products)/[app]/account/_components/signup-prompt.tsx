import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { OpenSignupModal } from "./open-signup-modal";

// SA-07 (spec: "Non connecté → modale d'inscription"): shown instead of the
// balance/movements/purchases when there is no session, no DAL call made.
// The link is the visible, no-JS-required fallback to the full /signup page
// (SA-03); OpenSignupModal is the client leaf that auto-opens the
// intercepted modal on top of this page. The Link href is a template
// literal inline in JSX, which typedRoutes accepts without a cast; passing
// the same slug to OpenSignupModal's `href: Route` prop still needs one,
// since typedRoutes cannot prove a plain string fits the route type outside
// a JSX href (docs/04-nextjs.md: "typedRoutes… type les href").
export async function SignupPrompt({ slug }: { slug: string }) {
  const t = await getTranslations("account");
  const href = `/${slug}/signup`;

  return (
    <>
      <EmptyState
        title={t("signup.title")}
        action={
          <Button asChild>
            <Link href={`/${slug}/signup`}>{t("signup.cta")}</Link>
          </Button>
        }
      />
      <OpenSignupModal href={href as Route} />
    </>
  );
}
