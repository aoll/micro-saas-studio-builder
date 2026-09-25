// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frAuth from "@/messages/fr/auth.json";
import enAuth from "@/messages/en/auth.json";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";

afterEach(cleanup);

const { requestMagicLink } = vi.hoisted(() => ({ requestMagicLink: vi.fn() }));
vi.mock("../_actions", () => ({ requestMagicLink }));

function renderUi(ui: React.ReactElement, locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? { auth: frAuth, common: frCommon } : { auth: enAuth, common: enCommon };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SignupFlow: form (fr and en)", () => {
  // Review fix: SignupFlow no longer renders the "Vous avez aimé ?" /
  // "3 crédits offerts" heading itself (the full page's <h1> and the
  // modal's DialogTitle own it now, see signup/page.tsx and
  // @modal/(.)signup/page.tsx), so this test only asserts the form it does
  // render. The heading assertion moved to those two pages' own tests.
  it("renders no heading and an empty, required email field (fr)", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />, "fr");

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.type).toBe("email");
    expect(email.required).toBe(true);
    expect(email.value).toBe("");
    expect(screen.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeTruthy();
  });

  it("renders no heading and the submit button in English", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />, "en");

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Get my sign-in link" })).toBeTruthy();
  });

  it("submits the typed email to requestMagicLink", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lea@exemple.fr" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() => expect(requestMagicLink).toHaveBeenCalled());
    // requestMagicLink.bind(null, slug) prepends the bound slug, so the
    // call is (slug, prevState, formData).
    const [boundSlug, , formData] = requestMagicLink.mock.calls[0] as [string, unknown, FormData];
    expect(boundSlug).toBe("lettre-pro");
    expect(formData.get("email")).toBe("lea@exemple.fr");
  });

  it("shows the translated error message for an action error", async () => {
    requestMagicLink.mockResolvedValue({ status: "error", error: "invalid_email" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Adresse email invalide"));
  });
});

describe("SignupFlow: expired link and resend", () => {
  it("shows the expired message and a resend button instead of the normal submit label (fr)", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" expired />, "fr");

    expect(screen.getByRole("heading", { name: "Lien expiré" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Ce lien a expiré ou a déjà été utilisé.");
    expect(screen.getByRole("button", { name: "Recevoir un nouveau lien" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Recevoir mon lien de connexion" })).toBeNull();
  });

  it("shows the expired message and resend button in English", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" expired />, "en");

    expect(screen.getByRole("heading", { name: "Link expired" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("This link has expired or was already used.");
    expect(screen.getByRole("button", { name: "Get a new link" })).toBeTruthy();
  });

  it("resending only needs the email again: no token or email is embedded in the form", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" expired />);

    const form = screen.getByRole("button", { name: "Recevoir un nouveau lien" }).closest("form")!;
    expect(form.querySelectorAll("input")).toHaveLength(1);
    expect(screen.getByLabelText("Email")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lea@exemple.fr" } });
    fireEvent.submit(form);

    await vi.waitFor(() => expect(requestMagicLink).toHaveBeenCalled());
    const [, , formData] = requestMagicLink.mock.calls[0] as [string, unknown, FormData];
    expect(formData.get("email")).toBe("lea@exemple.fr");
  });

  it("does not show the expired message when expired is false", async () => {
    requestMagicLink.mockResolvedValue({ status: "idle" });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Lien expiré" })).toBeNull();
    expect(screen.getByRole("button", { name: "Recevoir mon lien de connexion" })).toBeTruthy();
  });
});

describe("SignupFlow: inbox after sending", () => {
  it("shows the simulated inbox with a 'Me connecter' link to the verify URL", async () => {
    requestMagicLink.mockResolvedValue({
      status: "sent",
      email: "lea@exemple.fr",
      magicLinkUrl: "/api/auth/magic-link/verify?token=abc",
    });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lea@exemple.fr" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() => expect(screen.getByText(/lea@exemple\.fr/)).toBeTruthy());
    const link = screen.getByRole("link", { name: "Me connecter" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/auth/magic-link/verify?token=abc");
  });

  it("shows the empty-inbox message when there is no magic link (admin/owner email)", async () => {
    requestMagicLink.mockResolvedValue({ status: "sent", email: "admin@msb.local", magicLinkUrl: null });
    const { SignupFlow } = await import("./signup-flow");
    renderUi(<SignupFlow slug="lettre-pro" />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@msb.local" } });
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("Aucun email envoyé à cette adresse"));
    expect(screen.queryByRole("link", { name: "Me connecter" })).toBeNull();
  });
});
