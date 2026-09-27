import { describe, expect, it, vi } from "vitest";
import type { MessageMetadata } from "@vercel/queue";
import type { InvoiceQueueMessage } from "./route";

// CONTRACT-invoices-queue: handleInvoiceMessage is the raw MessageHandler,
// exported separately from POST (= handleCallback(handleInvoiceMessage))
// precisely so it can be called directly here with a fake (message,
// metadata) pair — handleCallback()'s own return type is a Web Request
// handler, not this function's signature, so POST itself isn't callable
// this way. @vercel/queue's HTTP plumbing (POST) is never exercised.
const listPurchases = vi.fn();
vi.mock("@/lib/dal/account", () => ({ listPurchases: (...args: unknown[]) => listPurchases(...args) }));

const startInvoiceJob = vi.fn();
const completeInvoiceJob = vi.fn();
const failInvoiceJob = vi.fn();
vi.mock("@/lib/dal/invoice-jobs", () => ({
  startInvoiceJob: (...args: unknown[]) => startInvoiceJob(...args),
  completeInvoiceJob: (...args: unknown[]) => completeInvoiceJob(...args),
  failInvoiceJob: (...args: unknown[]) => failInvoiceJob(...args),
}));

const renderInvoicePdf = vi.fn();
vi.mock("@/lib/invoice/render", () => ({ renderInvoicePdf: (...args: unknown[]) => renderInvoicePdf(...args) }));

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => put(...args) }));

vi.mock("@/lib/env", () => ({ env: { BLOB_READ_WRITE_TOKEN: "test-token" } }));

function metadata(overrides: Partial<MessageMetadata> = {}): MessageMetadata {
  return {
    messageId: "message-1",
    deliveryCount: 1,
    createdAt: new Date("2026-09-27T00:00:00Z"),
    expiresAt: new Date("2026-09-28T00:00:00Z"),
    topicName: "invoices",
    consumerGroup: "default",
    region: "cdg1",
    ...overrides,
  } as MessageMetadata;
}

function message(overrides: Partial<InvoiceQueueMessage> = {}): InvoiceQueueMessage {
  return {
    jobId: "job-1",
    userId: "user-1",
    productId: "product-1",
    month: "2026-06",
    productName: "BioInsta",
    buyerEmail: "lea@exemple.fr",
    ...overrides,
  };
}

describe("POST /api/queues/invoices", () => {
  it("renders, uploads and completes the job on a normal delivery", async () => {
    startInvoiceJob.mockResolvedValue({ id: "job-1", status: "processing" });
    listPurchases.mockResolvedValue([{ id: "p1", createdAt: new Date("2026-06-10T00:00:00Z") }]);
    renderInvoicePdf.mockResolvedValue(Buffer.from("pdf"));
    put.mockResolvedValue({ url: "https://blob.example/invoice.pdf" });
    completeInvoiceJob.mockResolvedValue(undefined);

    const { handleInvoiceMessage } = await import("./route");
    await handleInvoiceMessage(message(), metadata({ messageId: "msg-abc" }));

    expect(startInvoiceJob).toHaveBeenCalledWith("job-1");
    expect(put).toHaveBeenCalledWith(
      "invoices/user-1/product-1/msg-abc.pdf",
      expect.any(Buffer),
      expect.objectContaining({ addRandomSuffix: false, allowOverwrite: true, access: "public" }),
    );
    expect(completeInvoiceJob).toHaveBeenCalledWith("job-1", "https://blob.example/invoice.pdf");
    expect(failInvoiceJob).not.toHaveBeenCalled();
  });

  it("only renders purchases from the message's own month", async () => {
    startInvoiceJob.mockResolvedValue({ id: "job-1", status: "processing" });
    listPurchases.mockResolvedValue([
      { id: "p-june", createdAt: new Date("2026-06-10T00:00:00Z") },
      { id: "p-july", createdAt: new Date("2026-07-10T00:00:00Z") },
    ]);
    renderInvoicePdf.mockResolvedValue(Buffer.from("pdf"));
    put.mockResolvedValue({ url: "https://blob.example/invoice.pdf" });

    const { handleInvoiceMessage } = await import("./route");
    await handleInvoiceMessage(message({ month: "2026-06" }), metadata());

    expect(renderInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({ purchases: [expect.objectContaining({ id: "p-june" })] }),
    );
  });

  it("gives up immediately without doing any work once past the max delivery count", async () => {
    const { handleInvoiceMessage } = await import("./route");
    await handleInvoiceMessage(message(), metadata({ deliveryCount: 6 }));

    expect(startInvoiceJob).not.toHaveBeenCalled();
    expect(renderInvoicePdf).not.toHaveBeenCalled();
    expect(failInvoiceJob).toHaveBeenCalledWith("job-1", expect.any(String));
  });

  it("is a no-op when startInvoiceJob returns null (job already reached a terminal state)", async () => {
    startInvoiceJob.mockResolvedValue(null);

    const { handleInvoiceMessage } = await import("./route");
    await handleInvoiceMessage(message(), metadata());

    expect(listPurchases).not.toHaveBeenCalled();
    expect(renderInvoicePdf).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(completeInvoiceJob).not.toHaveBeenCalled();
    expect(failInvoiceJob).not.toHaveBeenCalled();
  });

  it("fails the job definitively on a render timeout, without rethrowing", async () => {
    startInvoiceJob.mockResolvedValue({ id: "job-1", status: "processing" });
    listPurchases.mockResolvedValue([]);
    renderInvoicePdf.mockImplementation(() => new Promise(() => {}));

    const { handleInvoiceMessage } = await import("./route");
    vi.useFakeTimers();
    const promise = handleInvoiceMessage(message(), metadata());
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();

    expect(failInvoiceJob).toHaveBeenCalledWith("job-1", "Délai dépassé (15 s)");
    expect(put).not.toHaveBeenCalled();
  });

  it("rethrows any other error so Vercel Queues retries the message, without marking the job failed", async () => {
    startInvoiceJob.mockResolvedValue({ id: "job-1", status: "processing" });
    listPurchases.mockResolvedValue([]);
    renderInvoicePdf.mockRejectedValue(new Error("transient blob error"));

    const { handleInvoiceMessage } = await import("./route");
    await expect(handleInvoiceMessage(message(), metadata())).rejects.toThrow("transient blob error");

    expect(failInvoiceJob).not.toHaveBeenCalled();
    expect(completeInvoiceJob).not.toHaveBeenCalled();
  });
});
