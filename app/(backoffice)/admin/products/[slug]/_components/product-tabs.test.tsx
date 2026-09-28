// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { ProductTabs } from "./product-tabs";

afterEach(cleanup);

const FR_LABELS = { overviewLabel: "Vue d'ensemble", activityLabel: "Activité" };
const EN_LABELS = { overviewLabel: "Overview", activityLabel: "Activity" };

// Shared between BO-03's SheetHeader (`active="overview"`) and BO-04's
// ActivityHeader (`active="activity"`) — promoted here (docs/09-arborescence.md
// "colocation first, promote next") because both routes now mount it.
// I18N-BACKOFFICE-STRINGS: the two labels are now passed in already
// translated by the async callers (sheet-header.tsx, activity-header.tsx),
// which each own their own getTranslations("backoffice-product-sheet") call
// — kept this component a plain, synchronous leaf.
describe("ProductTabs", () => {
  it("links the overview label to the sheet and the activity label to the activity screen", () => {
    render(<ProductTabs slug="nom-de-marque" active="overview" {...FR_LABELS} />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.getAttribute("href")).toBe("/admin/products/nom-de-marque");
    expect(activity.getAttribute("href")).toBe("/admin/products/nom-de-marque/activity");
  });

  it("marks the overview tab as current when active is overview", () => {
    render(<ProductTabs slug="nom-de-marque" active="overview" {...FR_LABELS} />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(overview.className).toContain("border-foreground");
    expect(activity.className).not.toContain("border-foreground");
  });

  it("marks the activity tab as current when active is activity", () => {
    render(<ProductTabs slug="nom-de-marque" active="activity" {...FR_LABELS} />);
    const overview = screen.getByRole("link", { name: "Vue d'ensemble" });
    const activity = screen.getByRole("link", { name: "Activité" });
    expect(activity.className).toContain("border-foreground");
    expect(overview.className).not.toContain("border-foreground");
  });

  // components/backoffice/nav-link.tsx:13 convention: the current tab carries
  // aria-current="page" for assistive tech, not just a visual class.
  it("sets aria-current=page on the active tab only, for both values of active", () => {
    const { unmount } = render(<ProductTabs slug="nom-de-marque" active="overview" {...FR_LABELS} />);
    expect(screen.getByRole("link", { name: "Vue d'ensemble" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Activité" }).getAttribute("aria-current")).toBeNull();
    unmount();

    render(<ProductTabs slug="nom-de-marque" active="activity" {...FR_LABELS} />);
    expect(screen.getByRole("link", { name: "Vue d'ensemble" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Activité" }).getAttribute("aria-current")).toBe("page");
  });

  it("renders whatever labels its caller passes (English, once translated upstream)", () => {
    render(<ProductTabs slug="nom-de-marque" active="overview" {...EN_LABELS} />);
    expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Activity" })).toBeTruthy();
  });
});
