import { KpiCard } from "@/components/backoffice/kpi-card";

// The 4 KPI cards of BO-03 (docs/02-ecrans.md), from `sheet.ts`'s `toKpis` — no deltas, no
// sparkline (plan design decision 3, orchestrator decision 4: the mockup's per-card deltas are
// left out).
export function SheetKpis({ kpis }: { kpis: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
      ))}
    </div>
  );
}
