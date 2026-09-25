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

  it("sends a visit beacon to the product's api/events on mount (specs/TRACKING.md bullet 1)", async () => {
    render(<TrackVisit slug="lettre-pro" />);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe("/lettre-pro/api/events");
    expect(blob.type).toBe("application/json");
    const { trackEventInputSchema } = await import("@/lib/schemas/inputs");
    const body: unknown = JSON.parse(await blob.text());
    expect(trackEventInputSchema.safeParse(body).success).toBe(true);
    expect((body as { type: string }).type).toBe("visit");
  });

  it("does not send a second beacon when the same slug re-renders", () => {
    const { rerender } = render(<TrackVisit slug="lettre-pro" />);
    rerender(<TrackVisit slug="lettre-pro" />);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("sends a second beacon when the slug changes", () => {
    const { rerender } = render(<TrackVisit slug="lettre-pro" />);
    rerender(<TrackVisit slug="bio-insta" />);
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(sendBeacon).toHaveBeenNthCalledWith(2, "/bio-insta/api/events", expect.any(Blob));
  });

  it("does not throw when navigator.sendBeacon is unavailable", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true, writable: true });
    expect(() => render(<TrackVisit slug="lettre-pro" />)).not.toThrow();
  });
});
