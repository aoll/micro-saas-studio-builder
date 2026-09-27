import { PROCESS_STEPS } from "../_data/run";

export function ProcessSteps() {
  return (
    <section aria-labelledby="mo-process" className="flex flex-col gap-5">
      <h2
        id="mo-process"
        className="font-[family-name:var(--font-mo-mono)] text-sm tracking-[0.1em] text-[#9AA1AD] uppercase"
      >
        00 · Le process
      </h2>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {PROCESS_STEPS.map((step, index) => (
          <li
            key={step.title}
            className={
              step.humanGate
                ? "flex min-h-[120px] flex-col gap-1.5 rounded-[10px] border-2 border-[#E8EAEE] bg-[#1D2129] p-3.5"
                : "flex min-h-[120px] flex-col gap-1.5 rounded-[10px] border border-[#262B36] bg-[#171A21] p-3.5"
            }
          >
            <span className="font-[family-name:var(--font-mo-mono)] text-xs text-[#9AA1AD]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold">{step.title}</span>
            <span className="text-[13px] leading-snug text-[#B8BEC9]">{step.who}</span>
            {step.humanGate ? <span className="sr-only">Porte humaine</span> : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[#9AA1AD]">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3.5 rounded-[3px] border-2 border-[#E8EAEE]" />
          Porte humaine
        </span>
        <span>Les étapes 3 à 7 tournent en parallèle, une spec par worktree, jusqu&apos;à 12 agents simultanés.</span>
      </div>
    </section>
  );
}
