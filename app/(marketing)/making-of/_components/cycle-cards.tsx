import { QA_PASSES } from "../_data/run";

const PEAK_FINDINGS = Math.max(...QA_PASSES.map((pass) => pass.findings));

function findingsLabel(findings: number): string {
  if (findings === 0) return "0 constat · 46/46 PASS";
  return `${findings} constat${findings > 1 ? "s" : ""}`;
}

export function CycleCards() {
  return (
    <section aria-label="Les deux cycles" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-xl border border-mk-line bg-mk-surface/80 p-7">
        <h2 className="font-[family-name:var(--font-mk-mono)] text-[13px] tracking-[0.1em] text-mk-link uppercase">
          Cycle 1 · Implémentation
        </h2>
        <p className="text-[22px] leading-snug font-semibold">
          28 specs en 11 heures, de nuit. Une spec démarre dès que ses dépendances sont mergées.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-mk-muted">
          <li>Contrats gelés d&apos;abord : types, schéma de données, UI de base.</li>
          <li>Puis 10 specs lancées dans la même minute, chacune dans son worktree et sa base Postgres.</li>
          <li>Plan, TDD, 5 relecteurs spécialisés, /verify, PR, merge : 199 agents au total.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-mk-line bg-mk-surface/80 p-7">
        <h2 className="font-[family-name:var(--font-mk-mono)] text-[13px] tracking-[0.1em] text-mk-rose-ink uppercase">
          Cycle 2 · QA et corrections
        </h2>
        <p className="text-[22px] leading-snug font-semibold">
          7 passes QA dans un vrai navigateur, jusqu&apos;à zéro constat.
        </p>
        <ul aria-label="Constats par passe QA" className="flex flex-col gap-1.5">
          {QA_PASSES.map((pass) => (
            <li key={pass.pass} className="flex items-center gap-3">
              <span className="w-16 font-[family-name:var(--font-mk-mono)] text-xs text-mk-muted">
                Passe {pass.pass}
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
              <span className="w-36 text-[13px] text-mk-muted">{findingsLabel(pass.findings)}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-mk-muted">
          Constats relevés par passe. 26 corrigés via 16 specs de correction, 3 écartés par l&apos;humain.
        </p>
      </div>
    </section>
  );
}
