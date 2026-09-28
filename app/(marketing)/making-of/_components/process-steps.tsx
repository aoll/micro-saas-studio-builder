import { getTranslations } from "next-intl/server";
import { PROCESS_STEPS } from "../_data/run";

export async function ProcessSteps() {
  const t = await getTranslations("making-of.processSteps");
  return (
    <section aria-labelledby="mo-process" className="flex flex-col gap-5">
      <h2
        id="mo-process"
        className="font-[family-name:var(--font-mk-mono)] text-sm tracking-[0.1em] text-mk-muted uppercase"
      >
        {t("heading")}
      </h2>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {PROCESS_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={
              step.humanGate
                ? "flex min-h-[120px] flex-col gap-1.5 rounded-[10px] border-2 border-mk-rose bg-mk-surface p-3.5"
                : "flex min-h-[120px] flex-col gap-1.5 rounded-[10px] border border-mk-line bg-mk-surface/80 p-3.5"
            }
          >
            <span className="font-[family-name:var(--font-mk-mono)] text-xs text-mk-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold">{t(`${step.id}.title`)}</span>
            <span className="text-[13px] leading-snug text-mk-muted">{t(`${step.id}.who`)}</span>
            {step.humanGate ? <span className="sr-only">{t("humanGateLabel")}</span> : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-mk-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3.5 rounded-[3px] border-2 border-mk-rose" />
          {t("humanGateLabel")}
        </span>
        <span>{t("parallelNote")}</span>
      </div>
    </section>
  );
}
