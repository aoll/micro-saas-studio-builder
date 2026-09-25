// @vitest-environment jsdom
import type { Route } from "next";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenSignupModal } from "./open-signup-modal";

// Review fix (LOW, code-reviewer): `href` is `Route`, not `Route | string`
// — `/nom-de-marque/signup` doesn't exist as a route yet (SA-03), so the
// literal is cast here the same way signup-prompt.tsx casts it at the call
// site.
const SIGNUP_HREF = "/nom-de-marque/signup" as Route;

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  cleanup();
  replace.mockClear();
});

// SA-07 (plan's design decision 5): auto-opens the signup modal (SA-03) by
// replacing the URL once, so a not-signed-in visitor lands on the modal
// instead of a dead end. `replace`, never `push`: closing the intercepted
// modal must not come back here and reopen it (a `push` history entry
// would).
describe("OpenSignupModal", () => {
  it("renders nothing and replaces the URL with href exactly once", () => {
    const { container, rerender } = render(<OpenSignupModal href={SIGNUP_HREF} />);
    expect(container.firstChild).toBeNull();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(SIGNUP_HREF);

    rerender(<OpenSignupModal href={SIGNUP_HREF} />);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
