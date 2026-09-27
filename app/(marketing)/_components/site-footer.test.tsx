// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("links to the making-of", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Making-of" }).getAttribute("href")).toBe("/making-of");
  });
});
