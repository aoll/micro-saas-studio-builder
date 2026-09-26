// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import frAccount from "@/messages/fr/account.json";
import invoicesFr from "@/messages/fr/invoices.json";
import type { AccountPurchase } from "@/lib/dal/account";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";

// SA-09 (specs/SA-09-facture.md): the async leaf of /[app]/account/invoices,
// mirroring account-content.test.tsx's own mocking boundary.
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));

const listPurchases = vi.fn();
vi.mock("@/lib/dal/account", () => ({ listPurchases: (...args: unknown[]) => listPurchases(...args) }));

const listInvoiceJobs = vi.fn();
vi.mock("@/lib/dal/invoice-jobs", () => ({ listInvoiceJobs: (...args: unknown[]) => listInvoiceJobs(...args) }));

const signupPromptSpy = vi.fn();
vi.mock("../../_components/signup-prompt", () => ({
  SignupPrompt: (props: unknown) => {
    signupPromptSpy(props);
    return <div data-testid="signup-prompt-stub" />;
  },
}));

const invoiceGeneratorSpy = vi.fn();
vi.mock("./invoice-generator", () => ({
  InvoiceGenerator: (props: unknown) => {
    invoiceGeneratorSpy(props);
    return <div data-testid="invoice-generator-stub" />;
  },
}));

afterEach(() => {
  cleanup();
  getSession.mockReset();
  listPurchases.mockReset();
  listInvoiceJobs.mockReset();
  signupPromptSpy.mockReset();
  invoiceGeneratorSpy.mockReset();
});

function purchase(overrides: Partial<AccountPurchase> = {}): AccountPurchase {
  return {
    id: "p1",
    createdAt: new Date("2026-06-15T00:00:00Z"),
    credits: 10,
    amountCents: 490,
    currency: "EUR",
    ...overrides,
  };
}

function job(overrides: Partial<InvoiceJob> = {}): InvoiceJob {
  return {
    id: "job-1",
    userId: "user-1",
    productId: "product-1",
    month: "2026-06",
    status: "queued",
    blobUrl: null,
    error: null,
    createdAt: new Date("2026-09-26T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

function renderUi(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, account: frAccount, invoices: invoicesFr }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("InvoicesContent — not signed in", () => {
  it("renders SignupPrompt and calls no DAL function", async () => {
    getSession.mockResolvedValue(null);
    const { InvoicesContent } = await import("./invoices-content");
    const ui = await InvoicesContent({ slug: "nom-de-marque", productId: "product-1" });
    renderUi(ui);

    expect(screen.getByTestId("signup-prompt-stub")).toBeTruthy();
    expect(signupPromptSpy).toHaveBeenCalledWith({ slug: "nom-de-marque" });
    expect(listPurchases).not.toHaveBeenCalled();
    expect(listInvoiceJobs).not.toHaveBeenCalled();
  });
});

describe("InvoicesContent — signed in", () => {
  it("computes the invoiceable months from this user's own purchases and forwards them with the job list", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", email: "lea@exemple.fr" } });
    listPurchases.mockResolvedValue([
      purchase({ createdAt: new Date("2026-06-10T00:00:00Z") }),
      purchase({ id: "p2", createdAt: new Date("2026-07-10T00:00:00Z") }),
    ]);
    const jobs = [job()];
    listInvoiceJobs.mockResolvedValue(jobs);

    const { InvoicesContent } = await import("./invoices-content");
    const ui = await InvoicesContent({ slug: "nom-de-marque", productId: "product-1" });
    renderUi(ui);

    expect(listPurchases).toHaveBeenCalledWith("user-1", "product-1");
    expect(listInvoiceJobs).toHaveBeenCalledWith({ userId: "user-1", productId: "product-1" });
    expect(screen.getByTestId("invoice-generator-stub")).toBeTruthy();
    expect(invoiceGeneratorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "nom-de-marque", initialJobs: jobs, months: ["2026-06", "2026-07"] }),
    );
  });
});
