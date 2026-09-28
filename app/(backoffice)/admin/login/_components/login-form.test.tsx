// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en/backoffice-portfolio.json";
import fr from "@/messages/fr/backoffice-portfolio.json";
import { LoginForm } from "./login-form";

const { login } = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock("../_actions", () => ({ login }));

afterEach(() => {
  cleanup();
  login.mockClear();
});

function renderUi(locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-portfolio": messages }}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("renders an empty, required email field with no placeholder", () => {
    login.mockResolvedValue({});
    renderUi();

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.type).toBe("email");
    expect(email.name).toBe("email");
    expect(email.autocomplete).toBe("email");
    expect(email.required).toBe(true);
    expect(email.value).toBe("");
    expect(email.placeholder).toBe("");
  });

  it("renders an empty, required password field with no placeholder", () => {
    login.mockResolvedValue({});
    renderUi();

    const password = screen.getByLabelText("Mot de passe") as HTMLInputElement;
    expect(password.type).toBe("password");
    expect(password.autocomplete).toBe("current-password");
    expect(password.required).toBe(true);
    expect(password.value).toBe("");
    expect(password.placeholder).toBe("");
  });

  it("renders exactly one 'Se connecter' button and no demo-prefill button", () => {
    login.mockResolvedValue({});
    renderUi();

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeTruthy();
    expect(screen.queryByText(/accès démo/i)).toBeNull();
  });

  it("shows the returned error as an alert and passes the typed values to the action", async () => {
    login.mockResolvedValue({ error: "Identifiants invalides" });
    renderUi();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "someone@example.test" } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Identifiants invalides"));
    // login.bind(null, locale) prepends locale (I18N-BACKOFFICE-STRINGS spec
    // "Server Actions"): useActionState then supplies (prevState, formData).
    const [locale, , formData] = login.mock.calls[0] as [string, unknown, FormData];
    expect(locale).toBe("fr");
    expect(formData.get("email")).toBe("someone@example.test");
    expect(formData.get("password")).toBe("wrong-password");
  });

  it("disables the submit button while the action is pending", async () => {
    let resolveLogin!: (state: { error?: string }) => void;
    login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderUi();

    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() =>
      expect((screen.getByRole("button", { name: "Se connecter" }) as HTMLButtonElement).disabled).toBe(true),
    );
    resolveLogin({});
  });

  it("renders English labels and binds the 'en' locale to the action", async () => {
    login.mockResolvedValue({});
    renderUi("en");

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();

    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    await vi.waitFor(() => expect(login).toHaveBeenCalled());
    const [locale] = login.mock.calls[0] as [string];
    expect(locale).toBe("en");
  });
});
