// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import { ExampleResult } from "./example-result";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ExampleResult", () => {
  it("renders the title and the example text, keeping line breaks", () => {
    renderUi(<ExampleResult exampleOutput={"Madame, Monsieur,\n\nJe candidate..."} />);
    expect(screen.getByRole("heading", { level: 2, name: "Exemple de résultat" })).toBeTruthy();
    const text = screen.getByText(/Je candidate/);
    expect(text.className).toContain("whitespace-pre-line");
    expect(text.textContent).toBe("Madame, Monsieur,\n\nJe candidate...");
  });

  it("renders nothing when exampleOutput is undefined", () => {
    const { container } = renderUi(<ExampleResult exampleOutput={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when exampleOutput is blank", () => {
    const { container } = renderUi(<ExampleResult exampleOutput="   " />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a bare blockquote, without card chrome, when bare is set", () => {
    const { container } = renderUi(<ExampleResult exampleOutput="Madame, Monsieur," bare />);
    expect(container.querySelector("blockquote")).toBeTruthy();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
  });
});
