// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

const { SignupFlow } = vi.hoisted(() => ({
  SignupFlow: vi.fn((props: { slug: string; expired?: boolean }) => (
    <div data-testid="signup-flow" data-expired={String(Boolean(props.expired))} />
  )),
}));
vi.mock("./signup-flow", () => ({ SignupFlow }));

describe("SignupPanel", () => {
  it("passes expired=false when there is no error search param", async () => {
    const { SignupPanel } = await import("./signup-panel");
    const ui = await SignupPanel({ slug: "lettre-pro", searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByTestId("signup-flow").dataset.expired).toBe("false");
    expect(SignupFlow).toHaveBeenCalledWith(expect.objectContaining({ slug: "lettre-pro", expired: false }), undefined);
  });

  it("passes expired=true for any error search param (expired or reused token alike)", async () => {
    const { SignupPanel } = await import("./signup-panel");
    const ui = await SignupPanel({
      slug: "lettre-pro",
      searchParams: Promise.resolve({ error: "INVALID_TOKEN" }),
    });
    render(ui);

    expect(screen.getByTestId("signup-flow").dataset.expired).toBe("true");
  });
});
