// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import invoicesFr from "@/messages/fr/invoices.json";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";
import { InvoiceGenerator } from "./invoice-generator";

// SA-09: the client leaf that owns the shared refreshSignal state between
// MonthPicker (bumps it on a successful generateInvoices() call) and
// JobStatusList (restarts its polling loop whenever it changes) — both
// mocked here (decision-panel.test.tsx's boundary), this is a wiring test.
const monthPickerSpy = vi.fn();
vi.mock("./month-picker", () => ({
  MonthPicker: (props: { slug: string; months: string[]; onGenerated: () => void }) => {
    monthPickerSpy(props);
    return (
      <button type="button" onClick={props.onGenerated}>
        stub-generate
      </button>
    );
  },
}));

const jobStatusListSpy = vi.fn();
vi.mock("./job-status-list", () => ({
  JobStatusList: (props: unknown) => {
    jobStatusListSpy(props);
    return <div data-testid="job-status-list-stub" />;
  },
}));

afterEach(() => {
  cleanup();
  monthPickerSpy.mockReset();
  jobStatusListSpy.mockReset();
});

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

function renderUi(initialJobs: InvoiceJob[] = []) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, invoices: invoicesFr }}>
      <InvoiceGenerator slug="bio-insta" months={["2026-06", "2026-07"]} initialJobs={initialJobs} />
    </NextIntlClientProvider>,
  );
}

describe("InvoiceGenerator", () => {
  it("forwards slug and months to MonthPicker, and slug and initialJobs to JobStatusList", () => {
    const jobs = [job()];
    renderUi(jobs);

    expect(monthPickerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "bio-insta", months: ["2026-06", "2026-07"] }),
    );
    expect(jobStatusListSpy).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "bio-insta", initialJobs: jobs, refreshSignal: 0 }),
    );
  });

  it("bumps JobStatusList's refreshSignal when MonthPicker reports a successful generation", () => {
    renderUi();
    expect(jobStatusListSpy).toHaveBeenLastCalledWith(expect.objectContaining({ refreshSignal: 0 }));

    fireEvent.click(screen.getByRole("button", { name: "stub-generate" }));

    expect(jobStatusListSpy).toHaveBeenLastCalledWith(expect.objectContaining({ refreshSignal: 1 }));
  });
});
