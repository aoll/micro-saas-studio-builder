// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ProductHeader } from "./product-header";

afterEach(cleanup);

describe("ProductHeader", () => {
  it("renders the product name and the balance node", () => {
    render(<ProductHeader slug="lettre-pro" name="LettrePro" balance={<span>3 crédits</span>} />);
    expect(screen.getByText("LettrePro")).toBeTruthy();
    expect(screen.getByText("3 crédits")).toBeTruthy();
  });

  it("renders the logo when logoUrl is set", () => {
    render(<ProductHeader slug="lettre-pro" name="LettrePro" logoUrl="https://example.com/logo.png" balance={null} />);
    const img = screen.getByRole("img", { name: "LettrePro" }) as HTMLImageElement;
    expect(img.src).toBe("https://example.com/logo.png");
  });

  it("renders no logo image without logoUrl", () => {
    render(<ProductHeader slug="lettre-pro" name="LettrePro" balance={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
