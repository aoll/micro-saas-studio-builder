import type { DecisionMetrics } from "@/lib/decision";
import type { Thresholds } from "@/lib/dal/thresholds";
import { formatPercent } from "@/app/(backoffice)/admin/_components/portfolio/format";
import { computeThresholdGauge, type GaugeZone } from "./decision-gauge-data";

const ZONE_COLOR: Record<GaugeZone, string> = { kill: "#dc2626", neutral: "#a1a1aa", scale: "#16a34a" };
const ZONE_FILL: Record<GaugeZone, string> = { kill: "#fecaca", neutral: "#e4e4e7", scale: "#bbf7d0" };
const ZONE_LABEL: Record<GaugeZone, string> = { kill: "à couper", neutral: "zone neutre", scale: "à scaler" };

const AXIS_WIDTH = 300;
const BAR_Y = 18;
const BAR_HEIGHT = 10;

// docs/01-produit.md › Statut Test → Learn → Scale → Killed (BO-03): the
// current conversion rate plotted against the studio's kill/scale
// thresholds, so the badge's verdict is something a visitor can *see*, not
// just read. Server-rendered (no interactivity), driven by the same
// primitives `evaluate()` reads — never a second source of truth for the
// decision itself, only its geometry (decision-gauge-data.ts).
export function DecisionGauge({ metrics, thresholds }: { metrics: DecisionMetrics; thresholds: Thresholds }) {
  const gauge = computeThresholdGauge(metrics, thresholds);
  const killEndX = gauge.zones.killEnd * AXIS_WIDTH;
  const scaleStartX = gauge.zones.scaleStart * AXIS_WIDTH;
  const markerX = gauge.marker ? gauge.marker.position * AXIS_WIDTH : null;
  const markerZone = gauge.marker?.zone;

  return (
    <div className="grid gap-2">
      <svg
        viewBox={`0 0 ${AXIS_WIDTH} 44`}
        className="w-full"
        role="img"
        aria-label="Position par rapport aux seuils de décision"
      >
        <rect x={0} y={BAR_Y} width={killEndX} height={BAR_HEIGHT} rx={4} fill={ZONE_FILL.kill} />
        <rect
          x={killEndX}
          y={BAR_Y}
          width={Math.max(0, scaleStartX - killEndX)}
          height={BAR_HEIGHT}
          fill={ZONE_FILL.neutral}
        />
        <rect
          x={scaleStartX}
          y={BAR_Y}
          width={Math.max(0, AXIS_WIDTH - scaleStartX)}
          height={BAR_HEIGHT}
          rx={4}
          fill={ZONE_FILL.scale}
        />
        <line
          x1={killEndX}
          x2={killEndX}
          y1={BAR_Y - 3}
          y2={BAR_Y + BAR_HEIGHT + 3}
          stroke={ZONE_COLOR.kill}
          strokeWidth={2}
        />
        <line
          x1={scaleStartX}
          x2={scaleStartX}
          y1={BAR_Y - 3}
          y2={BAR_Y + BAR_HEIGHT + 3}
          stroke={ZONE_COLOR.scale}
          strokeWidth={2}
        />
        <text x={killEndX} y={BAR_Y - 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">
          {formatPercent(thresholds.killMaxConversion)}
        </text>
        <text x={scaleStartX} y={BAR_Y - 6} textAnchor="middle" className="fill-muted-foreground text-[8px]">
          {formatPercent(thresholds.scaleMinConversion)}
        </text>
        {markerX !== null && markerZone ? (
          <g data-testid="gauge-marker">
            <circle
              cx={markerX}
              cy={BAR_Y + BAR_HEIGHT / 2}
              r={5}
              fill={ZONE_COLOR[markerZone]}
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={markerX}
              y={BAR_Y + BAR_HEIGHT + 16}
              textAnchor="middle"
              className="fill-foreground text-[9px] font-medium"
            >
              {formatPercent(metrics.signupToPurchaseRate)}
            </text>
          </g>
        ) : null}
      </svg>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["kill", "neutral", "scale"] as const).map((zone) => (
          <li key={zone} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: ZONE_COLOR[zone] }} />
            {ZONE_LABEL[zone]}
          </li>
        ))}
      </ul>
      {!gauge.gate.met ? (
        <p className="text-xs text-muted-foreground">
          Seuil de visites non atteint ({gauge.gate.visits.toLocaleString("fr-FR")} /{" "}
          {gauge.gate.minVisits.toLocaleString("fr-FR")}) — tendance indicative seulement, pas encore de verdict.
        </p>
      ) : null}
    </div>
  );
}
