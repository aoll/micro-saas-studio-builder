"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "../_actions";

const initialState: LoginState = {};

export function LoginForm({ prefill }: { prefill?: { email: string; password: string } }) {
  const t = useTranslations("backoffice-portfolio");
  // I18N-BACKOFFICE-STRINGS (spec "Server Actions"): the client-side locale
  // is bound as the action's first argument, before the (prevState,
  // formData) pair useActionState supplies — login() calls getTranslations
  // with it, never app() nor cookies() (both throw in a Server Action).
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(login.bind(null, locale), initialState);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">{t("login.emailLabel")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={prefill?.email ?? ""} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t("login.passwordLabel")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue={prefill?.password ?? ""}
          required
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {t("login.submit")}
      </Button>
    </form>
  );
}
