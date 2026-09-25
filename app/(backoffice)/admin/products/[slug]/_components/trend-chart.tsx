"use client";

import { Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import type { TrendPoint } from "./sheet";

// docs/01-produit.md › "courbes sur 30 jours": the only Recharts leaf on the sheet (plan design
// decision 7). An HTML legend rather than Recharts' own (harder to test and to theme) names the
// two series; the chart itself carries no axis labels beyond the x dates, kept minimal.
export function TrendChart({ points }: { points: TrendPoint[] }) {
  return (
    <div className="grid gap-2">
      <ul className="flex gap-4 text-sm">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
          Visites
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-accent-foreground" />
          Achats
        </li>
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="visits" stroke="var(--primary)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="purchases" stroke="var(--accent-foreground)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
