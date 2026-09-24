import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/utils";

type Trend = "up" | "down" | "flat";

const TREND_CLASSES: Record<Trend, string> = {
  up: "text-primary",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

// Normalises points to a 0..100 x / 0..100 y SVG polyline (no chart
// dependency, docs/02-ecrans.md › Carte KPI: value, 30-day delta, sparkline).
function sparklinePoints(points: number[]): string {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export function KpiCard({
  label,
  value,
  delta,
  points,
}: {
  label: string;
  value: string;
  delta?: { text: string; trend: Trend };
  points?: number[];
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          {delta ? <p className={cn("text-xs", TREND_CLASSES[delta.trend])}>{delta.text}</p> : null}
        </div>
        {points && points.length > 1 ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-20 text-primary" aria-hidden="true">
            <polyline points={sparklinePoints(points)} fill="none" stroke="currentColor" strokeWidth="4" />
          </svg>
        ) : null}
      </CardContent>
    </Card>
  );
}
