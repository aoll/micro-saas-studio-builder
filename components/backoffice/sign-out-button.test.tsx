// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: (...args: unknown[]) => signOut(...args) } }));

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  signOut.mockClear();
  push.mockClear();
  refresh.mockClear();
});

describe("SignOutButton", () => {
  it("signs out then redirects to /admin/login and refreshes", async () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/admin/login");
    expect(refresh).toHaveBeenCalled();
  });
});
