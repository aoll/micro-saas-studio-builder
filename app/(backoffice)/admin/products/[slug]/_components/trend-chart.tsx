"use client";

import { Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import type { TrendPoint } from "./sheet";

// Series colours of the BO-03 mockup (specs/mockups/BO-03.png): Visites in
// violet, Achats in orange and dashed. Fixed hex values rather than theme
// tokens: the backoffice's neutral primary/accent both render near-black,
// which made the two series indistinguishable (QA1 B16).
const SERIES = {
  visits: { label: "Visites", color: "#7c3aed", dash: undefined },
  purchases: { label: "Achats", color: "#f97316", dash: "5 4" },
} as const;

// docs/01-produit.md › "courbes sur 30 jours": the only Recharts leaf on the sheet (plan design
// decision 7). An HTML legend rather than Recharts' own (harder to test and to theme) names the
// two series; the chart itself carries no axis labels beyond the x dates, kept minimal.
export function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className="grid gap-2">
      <ul className="flex gap-4 text-sm">
        {Object.entries(SERIES).map(([key, series]) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              data-testid={`legend-${key}`}
              className="w-4 border-t-2"
              style={{ borderColor: series.color, borderStyle: series.dash ? "dashed" : "solid" }}
            />
            {series.label}
          </li>
        ))}
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="visits" stroke={SERIES.visits.color} dot={false} strokeWidth={2} />
            <Line
              type="monotone"
              dataKey="purchases"
              stroke={SERIES.purchases.color}
              strokeDasharray={SERIES.purchases.dash}
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
