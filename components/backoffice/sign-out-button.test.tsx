// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

const { signOut, push, refresh, toastError } = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

afterEach(() => {
  cleanup();
  signOut.mockClear();
  push.mockClear();
  refresh.mockClear();
  toastError.mockClear();
});

describe("SignOutButton", () => {
  it("signs out then redirects to /admin/login and refreshes", async () => {
    signOut.mockResolvedValue({ data: {}, error: null });
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/admin/login");
    expect(refresh).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows a toast and never navigates when signOut() resolves an error", async () => {
    signOut.mockResolvedValue({ data: null, error: { message: "Network error" } });
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a toast and never navigates when signOut() throws, never swallowed", async () => {
    signOut.mockRejectedValue(new Error("boom"));
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
