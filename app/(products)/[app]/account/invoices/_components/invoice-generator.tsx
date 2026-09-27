"use client";

import { useState } from "react";
import type { InvoiceJob } from "@/lib/dal/invoice-jobs";
import { JobStatusList } from "./job-status-list";
import { MonthPicker } from "./month-picker";

// SA-09 (specs/SA-09-facture.md): owns the one bit of state shared between
// MonthPicker and JobStatusList — a counter bumped on every successful
// generateInvoices() call, so JobStatusList's polling effect restarts even
// if a previous run had already settled and stopped scheduling itself
// (job-status-list.tsx).
export function InvoiceGenerator({
  slug,
  months,
  initialJobs,
}: {
  slug: string;
  months: string[];
  initialJobs: InvoiceJob[];
}) {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="grid gap-6">
      <MonthPicker slug={slug} months={months} onGenerated={() => setRefreshSignal((value) => value + 1)} />
      <JobStatusList slug={slug} initialJobs={initialJobs} refreshSignal={refreshSignal} />
    </div>
  );
}
