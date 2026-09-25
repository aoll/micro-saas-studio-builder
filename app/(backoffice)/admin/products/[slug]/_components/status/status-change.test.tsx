// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Changer de statut" }));
}

describe("StatusChange", () => {
  it("shows a trigger button, closed by default", () => {
    render(<StatusChange {...baseProps} />);
    expect(screen.getByRole("button", { name: "Changer de statut" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a modal with the product name, the current status, and the 3 justification numbers", () => {
    render(<StatusChange {...baseProps} />);
    openModal();

    expect(screen.getByRole("dialog", { name: "Changer le statut de My Product" })).toBeTruthy();
    expect(screen.getByText("1 200")).toBeTruthy();
    expect(screen.getByText("7 %")).toBeTruthy();
    expect(screen.getByText("0,50 €")).toBeTruthy();
  });

  it("lists the 4 statuses as radios, with the current one disabled", () => {
    render(<StatusChange {...baseProps} status="learn" />);
    openModal();

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(4);
    const current = screen.getByRole("radio", { name: "Learn" }) as HTMLInputElement;
    expect(current.disabled).toBe(true);
  });

  it("preselects the suggested status from decision when it differs from the current one", () => {
    render(<StatusChange {...baseProps} status="test" decision="scale" />);
    openModal();
    expect((screen.getByRole("radio", { name: "Scale" }) as HTMLInputElement).checked).toBe(true);
  });

  it("shows the killed warning and a destructive confirm label only when killed is selected", () => {
    render(<StatusChange {...baseProps} status="test" />);
    openModal();

    expect(screen.getByRole("button", { name: "Passer en Test" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Killed" }));

    expect(screen.getByRole("button", { name: "Passer en Killed" })).toBeTruthy();
    expect(screen.getByText(/ferme le produit/)).toBeTruthy();
  });

  it("closes the modal on Annuler", () => {
    render(<StatusChange {...baseProps} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("submits the chosen status and note, then toasts success and closes on ok", async () => {
    setProductStatus.mockResolvedValue({ ok: true });
    render(<StatusChange {...baseProps} status="test" />);
    openModal();

    fireEvent.click(screen.getByRole("radio", { name: "Scale" }));
    fireEvent.change(screen.getByLabelText("Note de décision"), { target: { value: "Good numbers" } });
    fireEvent.click(screen.getByRole("button", { name: "Passer en Scale" }));

    await vi.waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the form error as an alert on failure, without closing", async () => {
    setProductStatus.mockResolvedValue({ formError: "Le statut n'a pas pu être changé" });
    render(<StatusChange {...baseProps} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "Passer en Test" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Le statut n'a pas pu être changé");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
