// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import { SEED_ADMIN } from "@/scripts/seed";

vi.mock("./_actions", () => ({ login: vi.fn() }));

// The page reads the owner's credentials from `env` (lib/env.ts); each test
// sets the two variables it needs.
const env = vi.hoisted(() => ({
  SEED_OWNER_EMAIL: undefined as string | undefined,
  SEED_OWNER_PASSWORD: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env }));

// LoginPage is now an async Server Component (getTranslations, incl.
// t.rich for the owner-prefill note): next-intl/server is mocked with a
// real translator (see i18n/request.test.ts), and its LoginForm child (a
// real 'use client' component) needs a NextIntlClientProvider ancestor to
// resolve useTranslations/useLocale.
function mockNextIntlServer(locale: "fr" | "en") {
  const messages = locale === "fr" ? fr : en;
  vi.doMock("next-intl/server", () => ({
    getTranslations: async (namespace: string) =>
      createTranslator({ locale, messages: { "backoffice-portfolio": messages }, namespace: namespace as never }),
  }));
}

async function renderPage(locale: "fr" | "en" = "fr") {
  mockNextIntlServer(locale);
  const { default: LoginPage } = await import("./page");
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      {await LoginPage()}
    </NextIntlClientProvider>,
  );
}

const OWNER = { email: "owner@demo.test", password: "owner-demo-password" };

afterEach(() => {
  cleanup();
  vi.resetModules();
  env.SEED_OWNER_EMAIL = undefined;
  env.SEED_OWNER_PASSWORD = undefined;
});

function fieldValues() {
  return {
    email: (screen.getByLabelText("Email") as HTMLInputElement).value,
    password: (screen.getByLabelText("Mot de passe") as HTMLInputElement).value,
  };
}

describe("LoginPage", () => {
  it("shows the studio name and the backoffice subtitle", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("SaaS Studio");
    expect(screen.getByText("Connexion au backoffice")).toBeTruthy();
  });

  // BO-01, human decision of 2026-09-28: prefilled for the demo.
  it("prefills the owner's credentials from SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD", async () => {
    env.SEED_OWNER_EMAIL = OWNER.email;
    env.SEED_OWNER_PASSWORD = OWNER.password;
    await renderPage();
    expect(fieldValues()).toEqual({ email: OWNER.email, password: OWNER.password });
    expect(screen.getByRole("note").textContent).toContain("préremplis");
    expect(screen.getByRole("note").textContent).toContain("SEED_OWNER_EMAIL");
  });

  it.each([
    ["both owner variables are unset", {}],
    ["only the email is set", { SEED_OWNER_EMAIL: OWNER.email }],
    ["only the password is set", { SEED_OWNER_PASSWORD: OWNER.password }],
  ])("renders both fields empty when %s", async (_, values) => {
    Object.assign(env, values);
    await renderPage();
    expect(fieldValues()).toEqual({ email: "", password: "" });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never renders the seeded admin credentials", async () => {
    env.SEED_OWNER_EMAIL = OWNER.email;
    env.SEED_OWNER_PASSWORD = OWNER.password;
    const { container } = await renderPage();
    expect(container.innerHTML).not.toContain(SEED_ADMIN.email);
    expect(container.innerHTML).not.toContain(SEED_ADMIN.password);
  });

  // I18N-BACKOFFICE-STRINGS: the whole page, including the owner note's
  // t.rich() prose, renders in English.
  it("renders in English", async () => {
    env.SEED_OWNER_EMAIL = OWNER.email;
    env.SEED_OWNER_PASSWORD = OWNER.password;
    await renderPage("en");
    expect(screen.getByText("Sign in to the backoffice")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("prefilled");
    expect(screen.getByRole("note").textContent).toContain("SEED_OWNER_EMAIL");
  });
});
