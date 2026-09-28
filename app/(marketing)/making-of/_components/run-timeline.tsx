import {
  AGENTS_PER_HOUR,
  LANES,
  QA_CYCLE_START,
  QA_PASSES,
  TIMELINE_START,
  TIMELINE_TICKS,
  clockLabel,
  timelinePercent,
} from "../_data/run";

const IMPLEMENTATION = "var(--color-mk-blue)";
const QA = "var(--color-mk-rose)";
const PEAK_AGENTS = Math.max(...AGENTS_PER_HOUR);
// A bar never shrinks below this width, so a 3-minute worktree stays visible.
const MIN_BAR_PERCENT = 0.45;

// Every worktree of the run as one lane on a shared clock: a static Gantt,
// fully server-rendered. Native `title` tooltips give each bar's exact
// times; the table below carries the same data for screen readers.
export function RunTimeline() {
  return (
    <section aria-labelledby="mo-timeline" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2
            id="mo-timeline"
            className="font-[family-name:var(--font-mk-mono)] text-sm tracking-[0.1em] text-mk-muted uppercase"
          >
            01 · 02 · Les deux cycles, heure par heure
          </h2>
          <p className="max-w-2xl text-2xl font-semibold text-balance">
            Chaque ligne est un worktree. Chaque barre, la vie d&apos;une spec, du plan au merge.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-[13px] text-mk-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-sm" style={{ background: IMPLEMENTATION }} />
            Cycle 1 · implémentation
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-3.5 rounded-sm" style={{ background: QA }} />
            Cycle 2 · QA et corrections
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-mk-line bg-mk-surface/80">
        <div className="flex min-w-[760px] flex-col gap-[3px] px-6 py-5">
          <div className="flex h-6 gap-4">
            <span className="w-[200px] shrink-0 text-right text-[11px] text-mk-muted">Passes QA</span>
            <div className="relative flex-1">
              {QA_PASSES.map((pass) => (
                <span
                  key={pass.pass}
                  title={`Passe QA ${pass.pass} · ${clockLabel(pass.start)} · ${pass.findings} constat${pass.findings > 1 ? "s" : ""}`}
                  className="absolute top-0 -translate-x-1/2 font-[family-name:var(--font-mk-mono)] text-[10px] text-mk-rose-ink"
                  style={{ left: `${timelinePercent(pass.start)}%` }}
                >
                  P{pass.pass}
                </span>
              ))}
            </div>
          </div>

          <ul aria-label="Worktrees du run" className="flex flex-col gap-[3px]">
            {LANES.map((lane) => {
              const left = timelinePercent(lane.start);
              const width = Math.max(timelinePercent(lane.end) - left, MIN_BAR_PERCENT);
              return (
                <li key={lane.name} className="flex h-[11px] items-center gap-4">
                  <span className="w-[200px] shrink-0 truncate text-right font-[family-name:var(--font-mk-mono)] text-[9.5px] text-mk-muted">
                    {lane.name}
                  </span>
                  <div className="relative h-full flex-1 border-l border-mk-line">
                    <span
                      title={`${lane.name} · ${clockLabel(lane.start)} → ${clockLabel(lane.end)} · ${lane.agents} agents`}
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
            <span className="w-[200px] shrink-0 text-right text-xs text-mk-muted">Agents actifs par heure</span>
            <div className="flex h-16 flex-1 items-end gap-[2px]">
              {AGENTS_PER_HOUR.map((agents, index) => {
                const hour = TIMELINE_START + index;
                return (
                  <span
                    key={hour}
                    title={`À partir de ${clockLabel(hour)} · ${agents} agents`}
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
        <summary className="cursor-pointer">Voir les 59 worktrees sous forme de tableau</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="text-left text-[13px] tabular-nums">
            <thead className="text-mk-muted">
              <tr>
                <th className="py-1 pr-6 font-medium">Worktree</th>
                <th className="py-1 pr-6 font-medium">Cycle</th>
                <th className="py-1 pr-6 font-medium">Début</th>
                <th className="py-1 pr-6 font-medium">Fin</th>
                <th className="py-1 font-medium">Agents</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map((lane) => (
                <tr key={lane.name} className="border-t border-mk-line">
                  <td className="py-1 pr-6 font-[family-name:var(--font-mk-mono)]">{lane.name}</td>
                  <td className="py-1 pr-6">{lane.cycle === "implementation" ? "Implémentation" : "QA"}</td>
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
