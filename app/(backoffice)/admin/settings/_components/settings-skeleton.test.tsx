// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsSkeleton } from "./settings-skeleton";

afterEach(() => {
  cleanup();
});

describe("SettingsSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<SettingsSkeleton />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });
});
