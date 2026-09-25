// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_ADMIN, SEED_OWNER } from "@/scripts/seed";
import LoginPage from "./page";

vi.mock("./_actions", () => ({ login: vi.fn() }));

afterEach(() => {
  cleanup();
});

describe("LoginPage", () => {
  it("shows the studio name and the backoffice subtitle", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("SaaS Studio");
    expect(screen.getByText("Connexion au backoffice")).toBeTruthy();
  });

  it("never renders the seeded admin or owner credentials", () => {
    const { container } = render(<LoginPage />);
    const html = container.innerHTML;
    for (const value of [SEED_ADMIN.email, SEED_ADMIN.password, SEED_OWNER.email, SEED_OWNER.password]) {
      expect(html).not.toContain(value);
    }
  });

  it("renders both fields empty", () => {
    render(<LoginPage />);
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Mot de passe") as HTMLInputElement).value).toBe("");
  });
});
