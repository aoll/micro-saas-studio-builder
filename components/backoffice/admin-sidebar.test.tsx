// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/backoffice-shell.json";
import en from "@/messages/en/backoffice-shell.json";

const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));

// Mutable so each test can pick which locale next-intl/server resolves to;
// vi.hoisted keeps it reachable from the vi.mock factory below, which runs
// before this file's own top-level statements (I18N-BACKOFFICE-STRINGS).
const state = vi.hoisted(() => ({ locale: "fr" as "fr" | "en" }));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "backoffice-shell") =>
    createTranslator({
      locale: state.locale,
      messages: { "backoffice-shell": state.locale === "fr" ? fr : en },
      namespace,
    }),
  getLocale: async () => state.locale,
  getMessages: async () => ({ "backoffice-shell": state.locale === "fr" ? fr : en }),
}));

afterEach(() => {
  cleanup();
  state.locale = "fr";
});

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

  it("renders the 3 nav links in English when the backoffice locale is en", async () => {
    state.locale = "en";
    getSession.mockResolvedValue({ user: { email: "admin@demo.test", role: "admin" } });
    const { AdminSidebar } = await import("./admin-sidebar");
    const ui = await AdminSidebar();
    render(ui);
    expect(screen.getByRole("link", { name: "Portfolio" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Themes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  });
});
