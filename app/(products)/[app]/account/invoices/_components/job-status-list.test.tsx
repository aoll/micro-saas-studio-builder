// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { fireEvent, screen } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "@/messages/fr/common.json";
import invoicesFr from "@/messages/fr/invoices.json";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";
import { JobStatusList } from "./job-status-list";

const getInvoiceJobs = vi.fn();
const retryInvoice = vi.fn();
vi.mock("../_actions", () => ({
  getInvoiceJobs: (slug: string) => getInvoiceJobs(slug),
  retryInvoice: (slug: string, jobId: string) => retryInvoice(slug, jobId),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  getInvoiceJobs.mockReset();
  retryInvoice.mockReset();
  vi.useRealTimers();
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

function renderList(initialJobs: InvoiceJob[], refreshSignal = 0) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ common: fr, invoices: invoicesFr }}>
      <JobStatusList slug="bio-insta" initialJobs={initialJobs} refreshSignal={refreshSignal} />
    </NextIntlClientProvider>,
  );
}

describe("JobStatusList — empty", () => {
  it("shows the empty state when there is no job", async () => {
    getInvoiceJobs.mockResolvedValue({ ok: true, jobs: [] });
    renderList([]);
    expect(screen.getByText("Aucune facture générée pour le moment")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });
});

describe("JobStatusList — rendering", () => {
  it("renders each job's month and a text status label, never color alone", async () => {
    getInvoiceJobs.mockResolvedValue({
      ok: true,
      jobs: [
        job({ id: "j1", month: "2026-06", status: "queued" }),
        job({ id: "j2", month: "2026-07", status: "processing" }),
      ],
    });
    renderList([
      job({ id: "j1", month: "2026-06", status: "queued" }),
      job({ id: "j2", month: "2026-07", status: "processing" }),
    ]);

    expect(screen.getByText("2026-06")).toBeTruthy();
    expect(screen.getByText("En attente")).toBeTruthy();
    expect(screen.getByText("2026-07")).toBeTruthy();
    expect(screen.getByText("En cours")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it("shows an individual download link for a done job, and no retry button", async () => {
    const jobs = [job({ id: "j1", status: "done", blobUrl: "https://blob.example/j1.pdf" })];
    getInvoiceJobs.mockResolvedValue({ ok: true, jobs });
    renderList(jobs);

    expect(screen.getByText("Terminé")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Télécharger" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://blob.example/j1.pdf");
    expect(link.hasAttribute("download")).toBe(true);
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it("shows a Réessayer button for a failed job, and no download link", async () => {
    const jobs = [job({ id: "j1", status: "failed", error: "Délai dépassé (15 s)" })];
    getInvoiceJobs.mockResolvedValue({ ok: true, jobs });
    renderList(jobs);

    expect(screen.getByText("Échec")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Télécharger" })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });
});

// Self-rescheduling setTimeout, not setInterval (job-status-list.tsx): the
// component always polls once immediately on mount/refresh, then again
// every POLL_INTERVAL_MS as long as the latest result isn't settled yet.
const POLL_INTERVAL_MS = 1500;

describe("JobStatusList — polling", () => {
  it("polls immediately on mount and keeps polling every ~1.5s until every job settles, then stops", async () => {
    getInvoiceJobs
      .mockResolvedValueOnce({ ok: true, jobs: [job({ id: "j1", status: "processing" })] })
      .mockResolvedValueOnce({ ok: true, jobs: [job({ id: "j1", status: "processing" })] })
      .mockResolvedValueOnce({ ok: true, jobs: [job({ id: "j1", status: "done", blobUrl: "https://x/j1.pdf" })] });

    renderList([job({ id: "j1", status: "queued" })]);
    expect(screen.getByText("En attente")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getInvoiceJobs).toHaveBeenCalledTimes(1);
    expect(screen.getByText("En cours")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getInvoiceJobs).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(getInvoiceJobs).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Terminé")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // Settled: no further poll ever scheduled again.
    expect(getInvoiceJobs).toHaveBeenCalledTimes(3);
  });

  it("resumes polling when refreshSignal changes after a previous run had already settled", async () => {
    const doneJobs = [job({ id: "j1", status: "done", blobUrl: "https://x/j1.pdf" })];
    getInvoiceJobs.mockResolvedValue({ ok: true, jobs: doneJobs });

    const { rerender } = render(
      <NextIntlClientProvider locale="fr" messages={{ common: fr, invoices: invoicesFr }}>
        <JobStatusList slug="bio-insta" initialJobs={doneJobs} refreshSignal={0} />
      </NextIntlClientProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getInvoiceJobs).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    // Already settled: the one immediate poll never schedules a next one.
    expect(getInvoiceJobs).toHaveBeenCalledTimes(1);

    rerender(
      <NextIntlClientProvider locale="fr" messages={{ common: fr, invoices: invoicesFr }}>
        <JobStatusList slug="bio-insta" initialJobs={doneJobs} refreshSignal={1} />
      </NextIntlClientProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getInvoiceJobs).toHaveBeenCalledTimes(2);
  });
});

describe("JobStatusList — retry", () => {
  it("calls retryInvoice with the slug and job id when Réessayer is clicked", async () => {
    const jobs = [job({ id: "j1", status: "failed" })];
    getInvoiceJobs.mockResolvedValue({ ok: true, jobs });
    retryInvoice.mockResolvedValue({ ok: true });
    renderList(jobs);

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(retryInvoice).toHaveBeenCalledWith("bio-insta", "j1");
  });
});
