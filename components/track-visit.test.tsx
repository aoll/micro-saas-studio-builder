// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackVisit } from "./track-visit";

afterEach(cleanup);

describe("TrackVisit", () => {
  it("renders nothing", () => {
    const { container } = render(<TrackVisit slug="lettre-pro" />);
    expect(container.innerHTML).toBe("");
  });

  it("never calls navigator.sendBeacon (stub, replaced by lot C)", () => {
    const sendBeacon = vi.fn();
    Object.assign(navigator, { sendBeacon });
    render(<TrackVisit slug="lettre-pro" />);
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
