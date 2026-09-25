// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ProductFooter } from "./product-footer";

afterEach(cleanup);

describe("ProductFooter", () => {
  it("renders the product name", () => {
    render(<ProductFooter name="LettrePro" />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
  });

  it("renders no link to a studio listing page (none exists in the dossier)", () => {
    render(<ProductFooter name="LettrePro" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
