import Link from "next/link";
import { KEY_FIGURES } from "../_data/run";

export function ControlRoomHeader() {
  return (
    <header className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3 font-[family-name:var(--font-mk-mono)] text-xs tracking-[0.08em] text-mk-muted uppercase">
        <Link href="/" className="hover:text-mk-link hover:underline">
          Retour à la démo
        </Link>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-mk-ok" />
          Run terminé · 0 constat restant
        </span>
      </div>
      <p className="font-[family-name:var(--font-mk-mono)] text-xs tracking-[0.08em] text-mk-muted uppercase">
        Making-of · micro-saas-studio-builder
      </p>
      <h1 className="max-w-4xl font-[family-name:var(--font-mk-display)] text-4xl leading-[1.04] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
        258 agents IA, 30 heures, une plateforme en production.
      </h1>
      <p className="max-w-3xl text-lg leading-relaxed text-mk-muted sm:text-xl">
        Un orchestrateur a découpé le dossier de conception en 28 specs, les a fait implémenter en parallèle dans des
        worktrees isolés, puis a lancé la QA jusqu&apos;à ce qu&apos;il ne reste plus rien à corriger. Un humain valide
        aux portes clés.
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KEY_FIGURES.map((figure) => (
          <div key={figure.label} className="flex flex-col-reverse gap-1.5 mk-card px-4 py-4">
            <dt className="text-sm text-mk-muted">{figure.label}</dt>
            <dd className="font-[family-name:var(--font-mk-display)] text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
