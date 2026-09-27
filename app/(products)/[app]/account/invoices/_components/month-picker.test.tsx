// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import invoicesFr from "@/messages/fr/invoices.json";
import { MonthPicker } from "./month-picker";

const generateInvoices = vi.fn();
vi.mock("../_actions", () => ({
  generateInvoices: (slug: string, months: string[]) => generateInvoices(slug, months),
}));

afterEach(() => {
  cleanup();
  generateInvoices.mockReset();
});

/** A promise plus its own resolve, to control when generateInvoices() settles (checkout-flow.test.tsx's own trick). */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderPicker(months: string[], onGenerated = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, invoices: invoicesFr }}>
      <MonthPicker slug="bio-insta" months={months} onGenerated={onGenerated} />
    </NextIntlClientProvider>,
  );
}

describe("MonthPicker — no invoiceable month", () => {
  it("shows the empty state and no checkbox", () => {
    renderPicker([]);
    expect(screen.getByText("Aucun mois facturable pour le moment")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});

describe("MonthPicker — selection", () => {
  it("renders a checkbox per invoiceable month, unselected, with Générer disabled", () => {
    renderPicker(["2026-06", "2026-07"]);
    expect(screen.getByLabelText("2026-06")).toBeTruthy();
    expect(screen.getByLabelText("2026-07")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Générer" }).hasAttribute("disabled")).toBe(true);
  });

  it("enables Générer once at least one month is checked", () => {
    renderPicker(["2026-06", "2026-07"]);
    fireEvent.click(screen.getByLabelText("2026-06"));
    expect(screen.getByRole("button", { name: "Générer" }).hasAttribute("disabled")).toBe(false);
  });

  it("disables Générer again once every checked month is unchecked", () => {
    renderPicker(["2026-06"]);
    const checkbox = screen.getByLabelText("2026-06");
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: "Générer" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("MonthPicker — generate", () => {
  it("calls generateInvoices with the slug and the checked months only", async () => {
    generateInvoices.mockResolvedValue({ ok: true, jobs: [] });
    renderPicker(["2026-06", "2026-07", "2026-08"]);
    fireEvent.click(screen.getByLabelText("2026-06"));
    fireEvent.click(screen.getByLabelText("2026-08"));

    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    await vi.waitFor(() => expect(generateInvoices).toHaveBeenCalledTimes(1));
    const [slug, months] = generateInvoices.mock.calls[0] as [string, string[]];
    expect(slug).toBe("bio-insta");
    expect(months.sort()).toEqual(["2026-06", "2026-08"]);
  });

  it("calls onGenerated, clears the selection and disables Générer again on success", async () => {
    const onGenerated = vi.fn();
    generateInvoices.mockResolvedValue({ ok: true, jobs: [] });
    renderPicker(["2026-06"], onGenerated);
    fireEvent.click(screen.getByLabelText("2026-06"));
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    await vi.waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("2026-06") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Générer" }).hasAttribute("disabled")).toBe(true);
  });

  it("disables the button and shows a pending label while the request is in flight", async () => {
    const { promise, resolve } = deferred<{ ok: true; jobs: never[] }>();
    generateInvoices.mockReturnValue(promise);
    renderPicker(["2026-06"]);
    fireEvent.click(screen.getByLabelText("2026-06"));
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    const pendingButton = await screen.findByRole("button", { name: /Génération/ });
    expect(pendingButton.hasAttribute("disabled")).toBe(true);

    resolve({ ok: true, jobs: [] });
    await screen.findByRole("button", { name: "Générer" });
  });

  it("does not call generateInvoices twice on a double click", async () => {
    const { promise, resolve } = deferred<{ ok: true; jobs: never[] }>();
    generateInvoices.mockReturnValue(promise);
    renderPicker(["2026-06"]);
    fireEvent.click(screen.getByLabelText("2026-06"));
    const button = screen.getByRole("button", { name: "Générer" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(generateInvoices).toHaveBeenCalledTimes(1);
    resolve({ ok: true, jobs: [] });
    await screen.findByRole("button", { name: "Générer" });
  });

  it("shows an error and keeps the selection when generateInvoices fails", async () => {
    generateInvoices.mockResolvedValue({ ok: false, error: "failed" });
    const onGenerated = vi.fn();
    renderPicker(["2026-06"], onGenerated);
    fireEvent.click(screen.getByLabelText("2026-06"));
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    await screen.findByText("Impossible de lancer la génération, réessayez");
    expect(onGenerated).not.toHaveBeenCalled();
    expect((screen.getByLabelText("2026-06") as HTMLInputElement).checked).toBe(true);
  });
});
