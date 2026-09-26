"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InvoiceJob, InvoiceJobStatus } from "@/lib/dal/invoice-jobs";
import { getInvoiceJobs, retryInvoice } from "../_actions";

// SA-09 (specs/SA-09-facture.md): "visible en direct dans la liste (queued →
// processing → done), sans re-sélection ni ré-appui du visiteur". No
// polling idiom exists yet in this codebase to copy (task's own research):
// a plain useEffect + setInterval, cleared once every job has settled
// (done or failed) — restarted by bumping `refreshSignal` (InvoiceGenerator
// does this after a successful generateInvoices() call), since a previous
// run may already have cleared its own interval.
const POLL_INTERVAL_MS = 1500;

// docs/… dataviz convention (decision-gauge.tsx's legend): never color
// alone, always a text label next to the badge.
const STATUS_VARIANT: Record<InvoiceJobStatus, "secondary" | "default" | "outline" | "destructive"> = {
  queued: "secondary",
  processing: "default",
  done: "outline",
  failed: "destructive",
};

function isSettled(jobs: InvoiceJob[]): boolean {
  return jobs.every((job) => job.status === "done" || job.status === "failed");
}

export function JobStatusList({
  slug,
  initialJobs,
  refreshSignal,
}: {
  slug: string;
  initialJobs: InvoiceJob[];
  refreshSignal: number;
}) {
  const t = useTranslations("invoices");
  const [jobs, setJobs] = useState<InvoiceJob[]>(initialJobs);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // A self-rescheduling setTimeout, not setInterval: the next poll is only
    // scheduled once the previous one has resolved and turned out not
    // settled yet, so a slow request never overlaps with the next tick.
    async function poll() {
      const result = await getInvoiceJobs(slug);
      if (cancelled || !result.ok) return;
      setJobs(result.jobs);
      if (!isSettled(result.jobs)) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
    // refreshSignal (bumped by the parent after a fresh generateInvoices()
    // call) restarts this effect — and so this polling loop — even after a
    // previous run had already settled and stopped scheduling itself.
  }, [slug, refreshSignal]);

  function handleRetry(jobId: string) {
    setRetryingId(jobId);
    startTransition(async () => {
      await retryInvoice(slug, jobId);
      setRetryingId(null);
    });
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("jobs.empty")}</p>;
  }

  return (
    <div className="grid gap-3">
      <h2 className="font-medium">{t("jobs.title")}</h2>
      <ul className="grid gap-2">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>{job.month}</span>
            <Badge variant={STATUS_VARIANT[job.status]}>{t(`status.${job.status}`)}</Badge>
            {job.status === "done" && job.blobUrl ? (
              <a href={job.blobUrl} download className="underline">
                {t("jobs.download")}
              </a>
            ) : null}
            {job.status === "failed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRetry(job.id)}
                disabled={retryingId === job.id}
              >
                {retryingId === job.id ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    {t("jobs.retrying")}
                  </>
                ) : (
                  t("jobs.retry")
                )}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
