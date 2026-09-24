// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    render(
      <EmptyState title="Aucun produit" description="Créez votre premier produit" action={<button>Créer</button>} />,
    );
    expect(screen.getByText("Aucun produit")).toBeTruthy();
    expect(screen.getByText("Créez votre premier produit")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Créer" })).toBeTruthy();
  });

  it("renders without a description or an action", () => {
    render(<EmptyState title="Aucun produit" />);
    expect(screen.getByText("Aucun produit")).toBeTruthy();
  });
});
