// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ProductTabs } from "./product-tabs";

afterEach(cleanup);

// Shared between BO-03's SheetHeader (`active="overview"`) and BO-04's
// ActivityHeader (`active="activity"`) — promoted here (docs/09-arborescence.md
// "colocation first, promote next") because both routes now mount it.
describe("ProductTabs", () => {
  it("links Vue d'ensemble to the sheet and Activité to the activity screen", () => {
    render(<ProductTabs slug="nom-de-marque" active="overview" />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.getAttribute("href")).toBe("/admin/products/nom-de-marque");
    expect(activity.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity");
  });

  it("marks Vue d'ensemble as current when active is overview", () => {
    render(<ProductTabs slug="nom-de-marque" active="overview" />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.className).toContain("border-foreground");
    expect(activity.className).not.toContain("border-foreground");
  });

  it("marks Activité as current when active is activity", () => {
    render(<ProductTabs slug="nom-de-marque" active="activity" />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(activity.className).toContain("border-foreground");
    expect(overview.className).not.toContain("border-foreground");
  });
});
