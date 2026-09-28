import { getTranslations } from "next-intl/server";
import { QA_PASSES } from "../_data/run";

const PEAK_FINDINGS = Math.max(...QA_PASSES.map((pass) => pass.findings));

export async function CycleCards() {
  const [t, tImpl, tQa] = await Promise.all([
    getTranslations("making-of.cycles"),
    getTranslations("making-of.cycles.implementation"),
    getTranslations("making-of.cycles.qa"),
  ]);
  return (
    <section aria-label={t("sectionAriaLabel")} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-xl border border-mk-line bg-mk-surface/80 p-7">
        <h2 className="font-[family-name:var(--font-mk-mono)] text-[13px] tracking-[0.1em] text-mk-link uppercase">
          {tImpl("heading")}
        </h2>
        <p className="text-[22px] leading-snug font-semibold">{tImpl("summary")}</p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-mk-muted">
          <li>{tImpl("point1")}</li>
          <li>{tImpl("point2")}</li>
          <li>{tImpl("point3")}</li>
        </ul>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-mk-line bg-mk-surface/80 p-7">
        <h2 className="font-[family-name:var(--font-mk-mono)] text-[13px] tracking-[0.1em] text-mk-rose-ink uppercase">
          {tQa("heading")}
        </h2>
        <p className="text-[22px] leading-snug font-semibold">{tQa("summary")}</p>
        <ul aria-label={tQa("passesAriaLabel")} className="flex flex-col gap-1.5">
          {QA_PASSES.map((pass) => (
            <li key={pass.pass} className="flex items-center gap-3">
              <span className="w-16 font-[family-name:var(--font-mk-mono)] text-xs text-mk-muted">
                {tQa("passLabel", { pass: pass.pass })}
              </span>
              <span className="relative h-4 flex-1" aria-hidden="true">
                <span
                  className="absolute top-0.5 left-0 h-3 rounded-r-[3px]"
                  style={{
                    width: pass.findings === 0 ? "1.5%" : `${((pass.findings / PEAK_FINDINGS) * 100).toFixed(1)}%`,
                    background: pass.findings === 0 ? "var(--color-mk-ok)" : "var(--color-mk-rose)",
                  }}
                />
              </span>
              <span className="w-36 text-[13px] text-mk-muted">{tQa("findingsLabel", { count: pass.findings })}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-mk-muted">{tQa("footnote")}</p>
      </div>
    </section>
  );
}
