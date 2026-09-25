// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackVisit } from "./track-visit";

afterEach(cleanup);

const sendBeacon = vi.fn();

beforeEach(() => {
  sendBeacon.mockReset();
  Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true, writable: true });
});

describe("TrackVisit", () => {
  it("renders nothing", () => {
    const { container } = render(<TrackVisit slug="lettre-pro" />);
    expect(container.innerHTML).toBe("");
  });

  it("sends a visit beacon to the product's api/events on mount (specs/TRACKING.md bullet 1)", () => {
    render(<TrackVisit slug="lettre-pro" />);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/lettre-pro/api/events", expect.any(Blob));
  });
});
