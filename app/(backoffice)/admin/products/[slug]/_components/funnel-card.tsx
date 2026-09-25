import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelRow } from "./sheet";

// docs/02-ecrans.md › Funnel: "5 étapes avec volumes et taux de passage" — a row per step, label,
// count, pass rate, and a bar whose width already carries the clamped percentage (sheet.ts).
export function FunnelCard({ rows }: { rows: FunnelRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funnel</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <div key={row.type} className="grid gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="flex gap-1 text-muted-foreground">
                <span>{row.count}</span>
                <span>·</span>
                <span>{row.rate}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                data-testid={`funnel-bar-${row.type}`}
                className="h-2 rounded-full bg-primary"
                style={{ width: `${row.widthPercent}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
