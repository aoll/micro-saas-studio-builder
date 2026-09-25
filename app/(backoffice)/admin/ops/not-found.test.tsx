// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import OpsNotFound from "./not-found";

afterEach(cleanup);

// QA1-P1-B12: rendered for every non-owner session hitting /admin/ops once
// requireAdmin/the owner check in ops/page.tsx calls notFound() (the proxy's
// own NOT_FOUND_HTML in proxy.ts covers the no-cookie case before this ever
// renders). Same wording as proxy.ts's NOT_FOUND_HTML, no link to /admin: an
// owner-only page stays "cachée" even in its own error state.
describe("app/(backoffice)/admin/ops/not-found", () => {
  it("renders a French 'Page introuvable' heading", () => {
    render(<OpsNotFound />);
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeTruthy();
  });

  it("never links to /admin", () => {
    render(<OpsNotFound />);
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("never mentions ops or owner", () => {
    render(<OpsNotFound />);
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/ops|owner|propriétaire/);
  });
});
