// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";
import { AccountSignOutButton } from "./sign-out-button";

const { signOut, replace, refresh, toastError } = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

function renderUi(slug: string) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount }}>
      <AccountSignOutButton slug={slug} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  signOut.mockClear();
  replace.mockClear();
  refresh.mockClear();
  toastError.mockClear();
});

// SA-07 (plan's design decision 4): a product-scoped sign-out leaf,
// mirroring components/backoffice/sign-out-button.tsx with the same
// authClient, but redirecting to the product landing (`/${slug}`) instead
// of the backoffice login page.
describe("AccountSignOutButton", () => {
  it("signs out then replaces the URL with the product landing and refreshes", async () => {
    signOut.mockResolvedValue({ data: {}, error: null });
    renderUi("nom-de-marque");
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/nom-de-marque");
    expect(refresh).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows a toast and never navigates when signOut() resolves an error", async () => {
    signOut.mockResolvedValue({ data: null, error: { message: "Network error" } });
    renderUi("nom-de-marque");
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a toast and never navigates when signOut() throws, never swallowed", async () => {
    signOut.mockRejectedValue(new Error("boom"));
    renderUi("nom-de-marque");
    fireEvent.click(screen.getByRole("button"));
    await vi.waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
