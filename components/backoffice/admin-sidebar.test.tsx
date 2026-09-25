// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

afterEach(cleanup);

describe("AdminSidebar", () => {
  it("renders nothing without an admin session", async () => {
    getSession.mockResolvedValue(null);
    const { AdminSidebar } = await import("./admin-sidebar");
    const ui = await AdminSidebar();
    expect(ui).toBeNull();
  });

  it("renders the 3 nav links and the sign-out button with an admin session, but never the email", async () => {
    getSession.mockResolvedValue({ user: { email: "admin@demo.test", role: "admin" } });
    const { AdminSidebar } = await import("./admin-sidebar");
    const ui = await AdminSidebar();
    render(ui);
    expect(screen.getByRole("link", { name: "Portefeuille" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thèmes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Réglages" })).toBeTruthy();
    expect(screen.getByRole("button")).toBeTruthy();
    expect(screen.queryByText("admin@demo.test")).toBeNull();
  });
});
