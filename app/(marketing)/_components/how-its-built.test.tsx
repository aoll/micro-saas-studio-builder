// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { HowItsBuilt } from "./how-its-built";

afterEach(cleanup);

describe("HowItsBuilt", () => {
  it("links to the making-of and to the code", () => {
    render(<HowItsBuilt />);
    expect(screen.getByRole("link", { name: "Voir le making-of" }).getAttribute("href")).toBe("/making-off");
    expect(screen.getByRole("link", { name: "Voir le code sur GitHub" }).getAttribute("href")).toBe(
      "https://github.com/aoll/micro-saas-studio-builder",
    );
  });
});
