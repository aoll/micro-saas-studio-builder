// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

// Full behaviour coverage (killed, unknown, nested, listing, empty list,
// English) moved to app/(products)/_components/product-not-found.test.tsx
// when the SA-08 content was extracted into that shared component (plan
// round 2, task R2): every original case kept there, none weakened. This
// file only checks that the segment's not-found delegates to it.
vi.mock("@/app/(products)/_components/product-not-found", () => ({
  ProductNotFound: () => <p data-testid="product-not-found">stub</p>,
}));

describe("[app]/not-found", () => {
  it("renders the shared ProductNotFound content", async () => {
    const { default: NotFound } = await import("./not-found");
    render(await NotFound());
    expect(screen.getByTestId("product-not-found")).toBeTruthy();
  });
});
