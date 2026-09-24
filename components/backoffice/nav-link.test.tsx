// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavLink } from "./nav-link";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

afterEach(cleanup);

describe("NavLink", () => {
  it("marks the link as the current page when the pathname matches", () => {
    usePathname.mockReturnValue("/admin");
    render(<NavLink href="/admin">Portefeuille</NavLink>);
    expect(screen.getByRole("link", { name: "Portefeuille" }).getAttribute("aria-current")).toBe("page");
  });

  it("does not mark the link as current for a different pathname", () => {
    usePathname.mockReturnValue("/admin/themes");
    render(<NavLink href="/admin">Portefeuille</NavLink>);
    expect(screen.getByRole("link", { name: "Portefeuille" }).getAttribute("aria-current")).toBeNull();
  });
});
