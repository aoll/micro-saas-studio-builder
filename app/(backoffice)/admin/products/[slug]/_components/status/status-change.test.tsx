// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusChange } from "./status-change";

afterEach(cleanup);

describe("StatusChange", () => {
  it("renders nothing (BO-06 slot, not yet implemented)", () => {
    const { container } = render(
      <StatusChange
        productId="p1"
        slug="my-product"
        name="My Product"
        status="test"
        decision={null}
        justification={{ visits: "1 200", conversion: "7 %", margin: "0,50 €" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
