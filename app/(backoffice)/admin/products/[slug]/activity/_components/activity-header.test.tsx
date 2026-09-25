// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityHeader } from "./activity-header";

afterEach(cleanup);

describe("ActivityHeader", () => {
  it("shows the product name and status", () => {
    render(<ActivityHeader slug="nom-de-marque" name="NomDeMarque" status="test" />);
    expect(screen.getByRole("heading", { name: "NomDeMarque" })).toBeTruthy();
    expect(screen.getByTestId("status-badge")).toBeTruthy();
  });

  it("links Vue d'ensemble to the sheet and Activité to itself, Activité marked current", () => {
    render(<ActivityHeader slug="nom-de-marque" name="NomDeMarque" status="test" />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.getAttribute("href")).toBe("/admin/products/nom-de-marque");
    expect(activity.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity");
    expect(activity.className).toContain("border-foreground");
    expect(overview.className).not.toContain("border-foreground");
  });
});
