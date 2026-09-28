import { getTranslations } from "next-intl/server";
import {
  AGENTS_PER_HOUR,
  LANES,
  QA_CYCLE_START,
  QA_PASSES,
  TIMELINE_START,
  TIMELINE_TICKS,
  type Lane,
  clockLabel,
  timelinePercent,
} from "../_data/run";

const IMPLEMENTATION = "var(--color-mk-blue)";
const QA = "var(--color-mk-rose)";
const PEAK_AGENTS = Math.max(...AGENTS_PER_HOUR);
// A bar never shrinks below this width, so a 3-minute worktree stays visible.
const MIN_BAR_PERCENT = 0.45;

// The lane's own spec code (untranslated, e.g. "QA · P1-B3") plus its
// translated descriptive suffix for a QA lane, or just the code for an
// implementation lane (see run.ts's Lane type comment).
function laneName(lane: Lane, tLanes: (id: string) => string): string {
  return lane.labelId ? `${lane.name} ${tLanes(lane.labelId)}` : lane.name;
}

// Every worktree of the run as one lane on a shared clock: a static Gantt,
// fully server-rendered. Native `title` tooltips give each bar's exact
// times; the table below carries the same data for screen readers.
export async function RunTimeline() {
  const [t, tLanes] = await Promise.all([getTranslations("making-of.timeline"), getTranslations("making-of.qaLanes")]);
  return (
    <section aria-labelledby="mo-timeline" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2
            id="mo-timeline"
            className="font-[family-name:var(--font-mk-mono)] text-sm tracking-[0.1em] text-mk-muted uppercase"
          >
            {t("heading")}
          </h2>
          <p className="max-w-2xl text-2xl font-semibold text-balance">{t("tagline")}</p>
        </div>
        <div className="flex flex-wrap gap-5 text-[13px] text-mk-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-sm" style={{ background: IMPLEMENTATION }} />
            {t("legendImplementation")}
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-sm" style={{ background: QA }} />
            {t("legendQa")}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-mk-line bg-mk-surface/80">
        <div className="flex min-w-[760px] flex-col gap-[3px] px-6 py-5">
          <div className="flex h-6 gap-4">
            <span className="w-[200px] shrink-0 text-right text-[11px] text-mk-muted">{t("qaPassesLabel")}</span>
            <div className="relative flex-1">
              {QA_PASSES.map((pass) => (
                <span
                  key={pass.pass}
                  title={t("qaPassTooltip", { pass: pass.pass, clock: clockLabel(pass.start), count: pass.findings })}
                  className="absolute top-0 -translate-x-1/2 font-[family-name:var(--font-mk-mono)] text-[10px] text-mk-rose-ink"
                  style={{ left: `${timelinePercent(pass.start)}%` }}
                >
                  P{pass.pass}
                </span>
              ))}
            </div>
          </div>

          <ul aria-label={t("laneListAriaLabel")} className="flex flex-col gap-[3px]">
            {LANES.map((lane) => {
              const left = timelinePercent(lane.start);
              const width = Math.max(timelinePercent(lane.end) - left, MIN_BAR_PERCENT);
              const name = laneName(lane, tLanes);
              return (
                <li key={lane.name} className="flex h-[11px] items-center gap-4">
                  <span className="w-[200px] shrink-0 truncate text-right font-[family-name:var(--font-mk-mono)] text-[9.5px] text-mk-muted">
                    {name}
                  </span>
                  <div className="relative h-full flex-1 border-l border-mk-line">
                    <span
                      title={t("laneTooltip", {
                        name,
                        start: clockLabel(lane.start),
                        end: clockLabel(lane.end),
                        agents: lane.agents,
                      })}
                      className="absolute top-px h-[9px] rounded-r-[3px]"
                      style={{
                        left: `${left.toFixed(2)}%`,
                        width: `${width.toFixed(2)}%`,
                        background: lane.cycle === "implementation" ? IMPLEMENTATION : QA,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-1 flex h-6 gap-4">
            <span className="w-[200px] shrink-0" />
            <div className="relative flex-1">
              {TIMELINE_TICKS.map((tick) => (
                <span
                  key={tick}
                  className="absolute top-1 -translate-x-1/2 font-[family-name:var(--font-mk-mono)] text-[11px] text-mk-muted"
                  style={{ left: `${timelinePercent(tick)}%` }}
                >
                  {clockLabel(tick)}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2 flex gap-4">
            <span className="w-[200px] shrink-0 text-right text-xs text-mk-muted">{t("agentsPerHourLabel")}</span>
            <div className="flex h-16 flex-1 items-end gap-[2px]">
              {AGENTS_PER_HOUR.map((agents, index) => {
                const hour = TIMELINE_START + index;
                return (
                  <span
                    key={hour}
                    title={t("hourTooltip", { clock: clockLabel(hour), agents })}
                    className="flex-1 rounded-t-[3px]"
                    style={{
                      height: `${Math.max((agents / PEAK_AGENTS) * 100, 3).toFixed(1)}%`,
                      background: hour < QA_CYCLE_START ? IMPLEMENTATION : QA,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <details className="text-sm text-mk-muted">
        <summary className="cursor-pointer">{t("tableSummary", { count: LANES.length })}</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="text-left text-[13px] tabular-nums">
            <thead className="text-mk-muted">
              <tr>
                <th className="py-1 pr-6 font-medium">{t("tableWorktree")}</th>
                <th className="py-1 pr-6 font-medium">{t("tableCycle")}</th>
                <th className="py-1 pr-6 font-medium">{t("tableStart")}</th>
                <th className="py-1 pr-6 font-medium">{t("tableEnd")}</th>
                <th className="py-1 font-medium">{t("tableAgents")}</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map((lane) => (
                <tr key={lane.name} className="border-t border-mk-line">
                  <td className="py-1 pr-6 font-[family-name:var(--font-mk-mono)]">{laneName(lane, tLanes)}</td>
                  <td className="py-1 pr-6">
                    {lane.cycle === "implementation" ? t("cycleImplementation") : t("cycleQa")}
                  </td>
                  <td className="py-1 pr-6">{clockLabel(lane.start)}</td>
                  <td className="py-1 pr-6">{clockLabel(lane.end)}</td>
                  <td className="py-1">{lane.agents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
