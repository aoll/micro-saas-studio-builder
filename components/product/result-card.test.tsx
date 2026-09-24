// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr/common.json";
import { ResultCard } from "./result-card";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

afterEach(cleanup);

function renderCard(props: Partial<React.ComponentProps<typeof ResultCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr }}>
      <ResultCard output={{ kind: "markdown", text: "Bonjour **le monde**" }} fileName="lettre-motivation" {...props} />
    </NextIntlClientProvider>,
  );
}

describe("ResultCard", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it("renders markdown as plain pre-wrapped text, not HTML", () => {
    renderCard();
    expect(screen.getByText("Bonjour **le monde**")).toBeTruthy();
  });

  it("has an aria-live polite region", () => {
    const { container } = renderCard();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("copies the text and shows 'Copié' on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("Bonjour **le monde**"));
    await screen.findByText("Copié");
  });

  it("shows a toast error when the clipboard write is rejected, never swallowed", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Copier" }));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it("downloads a .md Blob named after fileName", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    renderCard();
    const link = screen.getByRole("link", { name: "Télécharger" }) as HTMLAnchorElement;
    fireEvent.click(link);
    expect(createObjectURL).toHaveBeenCalled();
    expect(link.download).toBe("lettre-motivation.md");
  });

  it("calls onRegenerate when the regenerate button is clicked", () => {
    const onRegenerate = vi.fn();
    renderCard({ onRegenerate });
    fireEvent.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(onRegenerate).toHaveBeenCalled();
  });

  it("does not render a regenerate button without onRegenerate", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: "Régénérer" })).toBeNull();
  });

  it("renders an image result with its alt text", () => {
    renderCard({ output: { kind: "image", url: "https://example.com/x.png", alt: "Logo généré" } });
    const img = screen.getByRole("img", { name: "Logo généré" }) as HTMLImageElement;
    expect(img.src).toBe("https://example.com/x.png");
  });
});
