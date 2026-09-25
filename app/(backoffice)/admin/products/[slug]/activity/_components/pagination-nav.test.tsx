// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { PaginationNav } from "./pagination-nav";

afterEach(cleanup);

describe("PaginationNav", () => {
  it("renders nothing on a single, full page (page 1, no more)", () => {
    const { container } = render(
      <PaginationNav slug="nom-de-marque" listKey="generations" page={1} hasMore={false} currentPages={{}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows only Suivant on the first page when there is more", () => {
    render(<PaginationNav slug="nom-de-marque" listKey="generations" page={1} hasMore currentPages={{}} />);
    expect(screen.getByRole("link", { name: "Suivant" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Précédent" })).toBeNull();
  });

  it("shows only Précédent on the last page", () => {
    render(<PaginationNav slug="nom-de-marque" listKey="generations" page={2} hasMore={false} currentPages={{}} />);
    expect(screen.getByRole("link", { name: "Précédent" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Suivant" })).toBeNull();
  });

  it("keeps the other lists' pages when linking Suivant", () => {
    render(
      <PaginationNav
        slug="nom-de-marque"
        listKey="movements"
        page={1}
        hasMore
        currentPages={{ generations: 3, purchases: 2 }}
      />,
    );
    const link = screen.getByRole("link", { name: "Suivant" });
    expect(link.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity?genPage=3&purPage=2&movPage=2");
  });
});
