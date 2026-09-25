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
// intercepted modal on top of this page. SA-03 has not landed yet: the
// cast is dropped once it does (mirrors pricing-content.tsx's checkout
// link).
export async function SignupPrompt({ slug }: { slug: string }) {
  const t = await getTranslations("account");
  const href = `/${slug}/signup`;

  return (
    <>
      <EmptyState
        title={t("signup.title")}
        action={
          <Button asChild>
            <Link href={href as Route}>{t("signup.cta")}</Link>
          </Button>
        }
      />
      <OpenSignupModal href={href as Route} />
    </>
  );
}
