// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/backoffice.json";
import { LocaleSwitcher } from "./locale-switcher";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function renderUi(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ backoffice: fr }}>
      <LocaleSwitcher />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  // The cookie the component writes is scoped to path=/admin (R7 of the
  // plan): jsdom only exposes a cookie through document.cookie when the
  // current location is under that path.
  window.history.pushState({}, "", "/admin");
});

afterEach(() => {
  cleanup();
  refresh.mockClear();
  document.cookie = "admin_locale=; path=/admin; max-age=0";
});

describe("LocaleSwitcher", () => {
  it("marks the active locale's button as pressed", () => {
    renderUi("fr");
    expect(screen.getByRole("button", { name: "Français" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking EN writes the admin_locale cookie and refreshes exactly once", () => {
    renderUi("fr");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(document.cookie).toContain("admin_locale=en");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clicking the already active locale still sets the cookie but does not double up on refresh", () => {
    renderUi("fr");
    fireEvent.click(screen.getByRole("button", { name: "Français" }));
    expect(document.cookie).toContain("admin_locale=fr");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
