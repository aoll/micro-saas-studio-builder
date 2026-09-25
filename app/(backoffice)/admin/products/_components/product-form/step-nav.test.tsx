// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STEPS, StepNav } from "./step-nav";

afterEach(cleanup);

describe("StepNav", () => {
  it("lists every step's title", () => {
    render(<StepNav current={1} onSelect={vi.fn()} stepErrors={{}} />);
    for (const step of STEPS) expect(screen.getByText(new RegExp(step.title))).toBeTruthy();
  });

  it("marks the current step", () => {
    render(<StepNav current={2} onSelect={vi.fn()} stepErrors={{}} />);
    const current = screen.getByRole("button", { name: /Thème/ });
    expect(current.getAttribute("aria-current")).toBe("step");
  });

  it("switches step on click", () => {
    const onSelect = vi.fn();
    render(<StepNav current={1} onSelect={onSelect} stepErrors={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Landing/ }));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("flags a step that has errors", () => {
    render(<StepNav current={1} onSelect={vi.fn()} stepErrors={{ 4: true }} />);
    const flagged = screen.getByRole("button", { name: /Champs/ });
    expect(flagged.getAttribute("data-has-error")).toBe("true");
  });
});
