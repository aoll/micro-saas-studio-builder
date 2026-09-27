// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { Hero } from "./hero";

afterEach(cleanup);

describe("Hero", () => {
  it("links to the making-of, right under the calls to action", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: "Découvrir le making-of" }).getAttribute("href")).toBe("/making-of");
  });
});
