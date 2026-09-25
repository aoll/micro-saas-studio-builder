// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioSkeleton } from "./portfolio-skeleton";

afterEach(cleanup);

describe("PortfolioSkeleton", () => {
  it("renders skeleton blocks (KPIs and table placeholders)", () => {
    const { container } = render(<PortfolioSkeleton />);
    const blocks = container.querySelectorAll('[data-slot="skeleton"]');
    expect(blocks.length).toBeGreaterThan(4);
  });
});
