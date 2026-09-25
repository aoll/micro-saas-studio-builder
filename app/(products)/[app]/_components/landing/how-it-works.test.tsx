// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import fr from "@/messages/fr/landing.json";
import { HowItWorks } from "./how-it-works";

afterEach(cleanup);

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ landing: fr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const steps = [
  { title: "Décrivez le poste", description: "Indiquez le poste visé, l'entreprise et votre expérience." },
  { title: "Choisissez le ton", description: "Formel ou dynamique." },
  { title: "Recevez votre lettre", description: "Une lettre prête à l'emploi." },
];

describe("HowItWorks", () => {
  it("renders the heading and one item per step, in order", () => {
    renderUi(<HowItWorks steps={steps} />);
    expect(screen.getByRole("heading", { level: 2, name: "Comment ça marche" })).toBeTruthy();
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain("Décrivez le poste");
    expect(items[2]?.textContent).toContain("Recevez votre lettre");
  });

  it("renders nothing when steps is undefined", () => {
    const { container } = renderUi(<HowItWorks steps={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when steps is empty", () => {
    const { container } = renderUi(<HowItWorks steps={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
