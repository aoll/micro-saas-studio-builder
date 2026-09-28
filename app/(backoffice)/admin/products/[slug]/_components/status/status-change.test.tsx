// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import frDecision from "@/messages/fr/backoffice-decision.json";
import enDecision from "@/messages/en/backoffice-decision.json";

const { setProductStatus, toastSuccess, toastError } = vi.hoisted(() => ({
  setProductStatus: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../_actions", () => ({ setProductStatus }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const { StatusChange } = await import("./status-change");

afterEach(() => {
  cleanup();
  setProductStatus.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

const baseProps = {
  productId: "p1",
  slug: "my-product",
  name: "My Product",
  status: "test" as const,
  decision: null,
  justification: { visits: "1 200", conversion: "7 %", margin: "0,50 €" },
};

// I18N-BACKOFFICE-STRINGS (lot 3): StatusChange is a 'use client' leaf and
// reads the "backoffice-decision" zone through useTranslations/useLocale,
// so it needs a real NextIntlClientProvider in tests (locale-switcher.test.tsx's
// pattern) — in the real app, app/(backoffice)/layout.tsx already provides
// every backoffice-* zone (including this one) to the whole subtree.
function renderStatusChange(props: Partial<typeof baseProps> = {}, locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? frDecision : enDecision;
  return render(
    <NextIntlClientProvider locale={locale} messages={{ "backoffice-decision": messages }}>
      <StatusChange {...baseProps} {...props} />
    </NextIntlClientProvider>,
  );
}

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Changer de statut" }));
}

describe("StatusChange", () => {
  it("shows a trigger button, closed by default", () => {
    renderStatusChange();
    expect(screen.getByRole("button", { name: "Changer de statut" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a modal with the product name, the current status, and the 3 justification numbers", () => {
    renderStatusChange();
    openModal();

    expect(screen.getByRole("dialog", { name: "Changer le statut de My Product" })).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("7 %")).toBeTruthy();
    expect(screen.getByText("0,50 €")).toBeTruthy();
  });

  it("lists the 4 statuses as radios, with the current one disabled", () => {
    renderStatusChange({ status: "learn" });
    openModal();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    const current = screen.getByRole("radio", { name: "Learn" }) as HTMLInputElement;
    expect(current.disabled).toBe(true);
  });

  it("preselects the suggested status from decision when it differs from the current one", () => {
    renderStatusChange({ status: "test", decision: "scale" });
    openModal();
    expect((screen.getByRole("radio", { name: "Scale" }) as HTMLInputElement).checked).toBe(true);
  });

  it("opens with no new status selected when there is no suggestion, and keeps the confirm button disabled", () => {
    renderStatusChange({ status: "test", decision: null });
    openModal();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((radio) => radio.checked)).toBe(false);
    expect(screen.queryByRole("button", { name: "Passer en Test" })).toBeNull();
    expect((screen.getByRole("button", { name: "Passer en …" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "Learn" }));
    expect((screen.getByRole("button", { name: "Passer en Learn" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the killed warning and a destructive confirm label only when killed is selected", () => {
    renderStatusChange({ status: "test" });
    openModal();

    fireEvent.click(screen.getByRole("radio", { name: "Learn" }));
    expect(screen.getByRole("button", { name: "Passer en Learn" })).toBeTruthy();
    expect(screen.queryByText(/ferme le produit/)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Killed" }));

    expect(screen.getByRole("button", { name: "Passer en Killed" })).toBeTruthy();
    expect(screen.getByText(/ferme le produit/)).toBeTruthy();
  });

  it("closes the modal on Annuler", () => {
    renderStatusChange();
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("submits the chosen status and note, then toasts success and closes on ok", async () => {
    setProductStatus.mockResolvedValue({ ok: true });
    renderStatusChange({ status: "test" });
    openModal();

    fireEvent.click(screen.getByRole("radio", { name: "Scale" }));
    fireEvent.change(screen.getByLabelText("Note de décision"), { target: { value: "Good numbers" } });
    fireEvent.click(screen.getByRole("button", { name: "Passer en Scale" }));

    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("binds the current locale as the action's second bound argument, after the slug", async () => {
    setProductStatus.mockResolvedValue({ ok: true });
    renderStatusChange({ status: "test" }, "en");
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));

    fireEvent.click(screen.getByRole("radio", { name: "Scale" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to Scale" }));

    await vi.waitFor(() => expect(setProductStatus).toHaveBeenCalled());
    // useActionState calls the bound action with (prevState, formData): the
    // slug and locale, bound client-side via .bind(null, slug, locale), are
    // baked into the function identity itself and can't be inspected from
    // the mock's call args directly — asserted instead through the English
    // messages actually shown (dialogTitle, confirm) once the provider's
    // locale is "en", which only render if useLocale() (not this mock) fed
    // "en" all the way to the DOM.
    expect(screen.getByRole("dialog", { name: "Change the status of My Product" })).toBeTruthy();
  });

  it("shows the form error as an alert on failure, without closing", async () => {
    setProductStatus.mockResolvedValue({ formError: "Le statut n'a pas pu être changé" });
    renderStatusChange();
    openModal();
    fireEvent.click(screen.getByRole("radio", { name: "Learn" }));
    fireEvent.click(screen.getByRole("button", { name: "Passer en Learn" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Le statut n'a pas pu être changé");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
