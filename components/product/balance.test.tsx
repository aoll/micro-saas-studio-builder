// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BalanceBadgeSkeleton } from "./balance";

afterEach(cleanup);

describe("BalanceBadgeSkeleton", () => {
  it("renders a hidden skeleton placeholder", () => {
    const { container } = render(<BalanceBadgeSkeleton />);
    const skeleton = container.firstElementChild!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
  });
});
