// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import { RouteModal } from "./route-modal";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

afterEach(() => {
  cleanup();
  back.mockClear();
});

function renderModal(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
      <RouteModal title="Paiement">{children}</RouteModal>
    </NextIntlClientProvider>,
  );
}

describe("RouteModal", () => {
  it("renders as an open dialog with a title and its children", () => {
    renderModal(<p>Contenu</p>);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Paiement")).toBeTruthy();
    expect(screen.getByText("Contenu")).toBeTruthy();
  });

  it("navigates back when the close button is clicked", () => {
    renderModal("contenu");
    fireEvent.click(screen.getByRole("button", { name: /close|fermer/i }));
    expect(back).toHaveBeenCalled();
  });

  it("navigates back on Escape", () => {
    renderModal("contenu");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(back).toHaveBeenCalled();
  });
});
