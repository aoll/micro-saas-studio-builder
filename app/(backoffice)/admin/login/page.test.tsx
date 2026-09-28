// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_ADMIN } from "@/scripts/seed";
import LoginPage from "./page";

vi.mock("./_actions", () => ({ login: vi.fn() }));

// The page reads the owner's credentials from `env` (lib/env.ts); each test
// sets the two variables it needs.
const env = vi.hoisted(() => ({
  SEED_OWNER_EMAIL: undefined as string | undefined,
  SEED_OWNER_PASSWORD: undefined as string | undefined,
}));
vi.mock("@/lib/env", () => ({ env }));

const OWNER = { email: "owner@demo.test", password: "owner-demo-password" };

afterEach(() => {
  cleanup();
  env.SEED_OWNER_EMAIL = undefined;
  env.SEED_OWNER_PASSWORD = undefined;
});

function fieldValues() {
  return {
    email: (screen.getByLabelText("Email") as HTMLInputElement).value,
    password: (screen.getByLabelText("Mot de passe") as HTMLInputElement).value,
  };
}

describe("LoginPage", () => {
  it("shows the studio name and the backoffice subtitle", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("SaaS Studio");
    expect(screen.getByText("Connexion au backoffice")).toBeTruthy();
  });

  // BO-01, human decision of 2026-09-28: prefilled for the demo.
  it("prefills the owner's credentials from SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD", () => {
    env.SEED_OWNER_EMAIL = OWNER.email;
    env.SEED_OWNER_PASSWORD = OWNER.password;
    render(<LoginPage />);
    expect(fieldValues()).toEqual({ email: OWNER.email, password: OWNER.password });
    expect(screen.getByRole("note").textContent).toContain("préremplis");
  });

  it.each([
    ["both owner variables are unset", {}],
    ["only the email is set", { SEED_OWNER_EMAIL: OWNER.email }],
    ["only the password is set", { SEED_OWNER_PASSWORD: OWNER.password }],
  ])("renders both fields empty when %s", (_, values) => {
    Object.assign(env, values);
    render(<LoginPage />);
    expect(fieldValues()).toEqual({ email: "", password: "" });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never renders the seeded admin credentials", () => {
    env.SEED_OWNER_EMAIL = OWNER.email;
    env.SEED_OWNER_PASSWORD = OWNER.password;
    const { container } = render(<LoginPage />);
    expect(container.innerHTML).not.toContain(SEED_ADMIN.email);
    expect(container.innerHTML).not.toContain(SEED_ADMIN.password);
  });
});
