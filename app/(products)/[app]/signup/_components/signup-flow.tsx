"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialSignupState, requestMagicLink } from "../_actions";

// SA-03 (specs/SA-03-inscription.md), plan step 2/6/7: shared by the full
// page and the intercepted modal. Three renders driven by `useActionState`
// on `requestMagicLink` (`.bind(null, slug)`, mirroring
// admin/products/_components/product-form.tsx's own bound action):
// - idle/error: the email form, with the inline error translated on the
//   client (SignupState never carries Better Auth's own message);
// - sent: the simulated inbox (docs/08-stack.md), "Me connecter" a plain
//   `<a>` to the real verify URL, or an empty-inbox message when there is
//   none (admin/owner email, or a send that produced no outbox row);
// - `expired` (from the page's `?error=` search param, not from
//   `SignupState`) shows one message above the same form, so resending
//   only ever asks for the email again (plan's decision 2: no email in
//   URLs or cookies).
export function SignupFlow({
  slug,
  freeCreditsOnSignup,
  expired = false,
}: {
  slug: string;
  freeCreditsOnSignup: number;
  expired?: boolean;
}) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(requestMagicLink.bind(null, slug), initialSignupState);

  if (state.status === "sent") {
    return (
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">{t("inbox.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("inbox.sentTo", { email: state.email })}</p>
        {state.magicLinkUrl ? (
          <div className="grid gap-2 rounded-md border p-4">
            <p className="text-sm font-medium">{t("inbox.subject")}</p>
            <p className="text-sm text-muted-foreground">{t("inbox.body")}</p>
            <Button asChild>
              <a href={state.magicLinkUrl}>{t("inbox.cta")}</a>
            </Button>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {t("inbox.empty")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">
          {t("heading")} <span className="text-primary">{t("headingAccent", { count: freeCreditsOnSignup })}</span>
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {expired ? (
        <p role="alert" className="text-sm text-destructive">
          {t("expired.message")}
        </p>
      ) : null}
      <form action={formAction} className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue="" required />
        </div>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {expired ? t("expired.resend") : t("submit")}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t("helper")}</p>
    </div>
  );
}
