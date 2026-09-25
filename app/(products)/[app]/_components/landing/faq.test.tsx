// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import { Faq } from "./faq";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const entries = [
  { question: "Combien coûte une génération ?", answer: "1 crédit par lettre générée." },
  { question: "Puis-je modifier le résultat ?", answer: "Oui, librement." },
];

describe("Faq", () => {
  it("renders the heading and one details element per entry", () => {
    renderUi(<Faq entries={entries} />);
    expect(screen.getByRole("heading", { level: 2, name: "Questions fréquentes" })).toBeTruthy();
    expect(screen.getByText("Combien coûte une génération ?").tagName).toBe("SUMMARY");
    expect(screen.getByText("1 crédit par lettre générée.")).toBeTruthy();
    expect(screen.getByText("Puis-je modifier le résultat ?")).toBeTruthy();
  });

  it("renders nothing when entries is empty", () => {
    const { container } = renderUi(<Faq entries={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
