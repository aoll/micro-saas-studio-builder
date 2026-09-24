// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ProductStatus } from "@/lib/schemas/product-config";
import { StatusBadge } from "./status-badge";

afterEach(cleanup);

const cases: [ProductStatus, string][] = [
  ["test", "Test"],
  ["learn", "Learn"],
  ["scale", "Scale"],
  ["killed", "Killed"],
];

describe("StatusBadge", () => {
  it.each(cases)("renders the %s status with the label %s and its own colour", (status, label) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge.getAttribute("data-status")).toBe(status);
  });

  it("gives each status a distinct colour class", () => {
    const classesByStatus = cases.map(([status]) => {
      const { unmount } = render(<StatusBadge status={status} />);
      const badge = screen.getByTestId("status-badge");
      const className = badge.className;
      unmount();
      return className;
    });
    expect(new Set(classesByStatus).size).toBe(cases.length);
  });
});
