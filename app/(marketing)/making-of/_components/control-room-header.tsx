import Link from "next/link";
import { KEY_FIGURES } from "../_data/run";

export function ControlRoomHeader() {
  return (
    <header className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-mo-mono)] text-xs tracking-[0.08em] text-[#9AA1AD] uppercase">
        <Link href="/" className="hover:text-[#E8EAEE] hover:underline">
          Retour à la démo
        </Link>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#3FB67A]" />
          Run terminé · 0 constat restant
        </span>
      </div>
      <p className="font-[family-name:var(--font-mo-mono)] text-xs tracking-[0.08em] text-[#9AA1AD] uppercase">
        Making-of · micro-saas-studio-builder
      </p>
      <h1 className="max-w-4xl font-[family-name:var(--font-mo-mono)] text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
        258 agents IA, 30 heures, une plateforme en production.
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-[#B8BEC9] sm:text-xl">
        Un orchestrateur a découpé le dossier de conception en 28 specs, les a fait implémenter en parallèle dans des
        worktrees isolés, puis a lancé la QA jusqu&apos;à ce qu&apos;il ne reste plus rien à corriger. Un humain valide
        aux portes clés.
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KEY_FIGURES.map((figure) => (
          <div
            key={figure.label}
            className="flex flex-col-reverse gap-1.5 rounded-[10px] border border-[#262B36] bg-[#171A21] px-4 py-4"
          >
            <dt className="text-sm text-[#9AA1AD]">{figure.label}</dt>
            <dd className="font-[family-name:var(--font-mo-mono)] text-3xl font-semibold tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
